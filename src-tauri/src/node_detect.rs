use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use base64::{engine::general_purpose::STANDARD, Engine};
use image::{imageops, DynamicImage, GrayImage};
use once_cell::sync::OnceCell;
use ort::{
    inputs,
    session::{builder::GraphOptimizationLevel, Session},
    value::Tensor,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

type Result<T> = std::result::Result<T, String>;

#[derive(Deserialize, Debug, Clone)]
pub struct DecodeConfig {
    pub thresh: f32,
    pub window: i64,
    pub per_channel_topk: i64,
    pub max_peaks: i64,
    pub fallback_topk: i64,
    pub assign_root_leftmost_when_two_classes: bool,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ModelConfig {
    pub backbone: String,
    pub in_channels: i64,
    pub internal_only: bool,
    pub no_root_pred: bool,
    pub normalize_input: bool,
    pub max_side: i64,
    pub pad_multiple: i64,
    pub decode: DecodeConfig,
}

#[derive(Serialize, Debug, Clone)]
pub struct PredictedNode {
    pub x: f32,
    pub y: f32,
    pub node_type: String,
    pub score: f32,
}

struct NodeModel {
    session: Mutex<Session>,
    config: ModelConfig,
}

static NODE_MODEL: OnceCell<Arc<NodeModel>> = OnceCell::new();

fn resolve_model_paths(app_handle: &AppHandle) -> Result<(PathBuf, PathBuf)> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(mut exe_dir) = std::env::current_exe() {
        if exe_dir.pop() {
            candidates.push(exe_dir.join("model").join("model.onnx"));
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("model").join("model.onnx"));
        if cfg!(debug_assertions) {
            candidates.push(cwd.join("src-tauri").join("model").join("model.onnx"));
            if let Some(parent) = cwd.parent() {
                candidates.push(parent.join("src-tauri").join("model").join("model.onnx"));
            }
        }
    }

    for candidate in candidates {
        let cfg_path = candidate.with_file_name("model.config.json");
        if candidate.is_file() && cfg_path.is_file() {
            return Ok((candidate, cfg_path));
        }
    }

    Err("Unable to find model files; expected model.onnx and model.config.json".to_string())
}

fn load_model(app_handle: &AppHandle) -> Result<Arc<NodeModel>> {
    NODE_MODEL
        .get_or_try_init::<_, String>(|| {
            let (model_path, cfg_path) = resolve_model_paths(app_handle)?;

            let cfg_bytes =
                std::fs::read(&cfg_path).map_err(|e| format!("Failed to read config: {e}"))?;
            let config: ModelConfig = serde_json::from_slice(&cfg_bytes)
                .map_err(|e| format!("Config parse error: {e}"))?;

            let session = Session::builder()
                .map_err(|e| format!("Failed to create ONNX session builder: {e}"))?
                .with_optimization_level(GraphOptimizationLevel::Level1)
                .map_err(|e| format!("Failed to set optimization level: {e}"))?
                .commit_from_file(&model_path)
                .map_err(|e| format!("Failed to load model: {e}"))?;

            Ok(Arc::new(NodeModel {
                session: Mutex::new(session),
                config,
            }))
        })
        .cloned()
        .map_err(|e| format!("Model init error: {e}"))
}

fn strip_data_url_prefix(data_url: &str) -> &str {
    const PREFIX: &str = "data:image/png;base64,";
    data_url.strip_prefix(PREFIX).unwrap_or(data_url)
}

fn decode_data_url_to_image(data_url: &str) -> Result<DynamicImage> {
    let raw = strip_data_url_prefix(data_url);
    let bytes = STANDARD
        .decode(raw)
        .map_err(|e| format!("Failed to decode image data: {e}"))?;
    image::load_from_memory(&bytes).map_err(|e| format!("Failed to parse PNG: {e}"))
}

fn crop_to_rect(img: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> Result<GrayImage> {
    let gray = img.to_luma8();

    if w == 0 || h == 0 {
        return Err("Crop width/height must be > 0".into());
    }

    let x0 = x.min(gray.width());
    let y0 = y.min(gray.height());
    let w = w.min(gray.width().saturating_sub(x0));
    let h = h.min(gray.height().saturating_sub(y0));

    if w == 0 || h == 0 {
        return Err("Crop is outside image bounds".into());
    }

    Ok(imageops::crop_imm(&gray, x0, y0, w, h).to_image())
}

fn resize_keep_aspect(arr: &GrayImage, max_side: u32) -> (GrayImage, f32, f32) {
    let (w, h) = arr.dimensions();
    if max_side == 0 || (w.max(h) <= max_side) {
        return (arr.clone(), 1.0, 1.0);
    }

    let scale = max_side as f32 / w.max(h) as f32;
    let new_w = (w as f32 * scale).round().max(1.0) as u32;
    let new_h = (h as f32 * scale).round().max(1.0) as u32;

    let resized = imageops::resize(arr, new_w, new_h, imageops::FilterType::CatmullRom);
    (resized, new_w as f32 / w as f32, new_h as f32 / h as f32)
}

fn pad_to_multiple(arr: &GrayImage, multiple: u32) -> (GrayImage, u32, u32) {
    if multiple == 0 {
        return (arr.clone(), 0, 0);
    }

    let (w, h) = arr.dimensions();
    let pad_w = (multiple - (w % multiple)) % multiple;
    let pad_h = (multiple - (h % multiple)) % multiple;

    if pad_w == 0 && pad_h == 0 {
        return (arr.clone(), 0, 0);
    }

    let mut padded = GrayImage::new(w + pad_w, h + pad_h);
    imageops::overlay(&mut padded, arr, 0, 0);
    (padded, pad_w, pad_h)
}

fn image_to_tensor(arr: &GrayImage, in_channels: i64) -> Result<Tensor<f32>> {
    let (w, h) = arr.dimensions();
    let pixels = arr.as_raw();

    if in_channels <= 0 {
        return Err("Model expects at least one input channel".into());
    }

    let mut data = Vec::with_capacity(pixels.len() * in_channels as usize);
    for _ in 0..in_channels {
        for &p in pixels.iter() {
            data.push(p as f32 / 255.0);
        }
    }

    Tensor::from_array((
        vec![1usize, in_channels as usize, h as usize, w as usize],
        data.into_boxed_slice(),
    ))
    .map_err(|e| format!("Failed to build input tensor: {e}"))
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

fn detect_local_maxima(
    logits: &[f32],
    c: usize,
    h: usize,
    w: usize,
    cfg: &DecodeConfig,
    valid_w: usize,
    valid_h: usize,
    thresh: f32,
) -> Vec<(usize, usize, usize, f32)> {
    let mut peaks = Vec::new();
    let window = cfg.window.max(1) as usize;
    let half = window / 2;

    for ch in 0..c {
        for y in 0..valid_h {
            for x in 0..valid_w {
                let idx = (ch * h + y) * w + x;
                let score = sigmoid(logits[idx]);
                if score < thresh {
                    continue;
                }

                let mut is_max = true;
                let y0 = y.saturating_sub(half);
                let y1 = (y + half).min(valid_h.saturating_sub(1));
                let x0 = x.saturating_sub(half);
                let x1 = (x + half).min(valid_w.saturating_sub(1));

                'outer: for yy in y0..=y1 {
                    for xx in x0..=x1 {
                        let j = (ch * h + yy) * w + xx;
                        if logits[j] > logits[idx] {
                            is_max = false;
                            break 'outer;
                        }
                    }
                }

                if is_max {
                    peaks.push((x, y, ch, score));
                }
            }
        }
    }

    peaks
}

fn decode_peaks(
    logits: &[f32],
    c: usize,
    h: usize,
    w: usize,
    cfg: &DecodeConfig,
    valid_w: usize,
    valid_h: usize,
) -> Vec<(usize, usize, usize, f32)> {
    let mut peaks = detect_local_maxima(logits, c, h, w, cfg, valid_w, valid_h, cfg.thresh);

    if peaks.is_empty() && cfg.fallback_topk > 0 {
        let mut fallback =
            detect_local_maxima(logits, c, h, w, cfg, valid_w, valid_h, f32::NEG_INFINITY);
        fallback.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));
        fallback.truncate(cfg.fallback_topk.max(0) as usize);
        return fallback;
    }

    if cfg.per_channel_topk > 0 {
        let per_channel = cfg.per_channel_topk as usize;
        let mut by_channel: Vec<Vec<(usize, usize, usize, f32)>> = vec![Vec::new(); c];
        for peak in peaks.drain(..) {
            by_channel[peak.2].push(peak);
        }
        peaks = by_channel
            .into_iter()
            .flat_map(|mut v| {
                v.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));
                v.truncate(per_channel);
                v
            })
            .collect();
    }

    peaks.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));

    if cfg.max_peaks > 0 && peaks.len() > cfg.max_peaks as usize {
        peaks.truncate(cfg.max_peaks as usize);
    }

    peaks
}

fn channel_to_type(channel: usize, cfg: &ModelConfig) -> &'static str {
    if cfg.internal_only {
        "internal"
    } else if cfg.no_root_pred {
        match channel {
            0 => "tip",
            _ => "internal",
        }
    } else {
        match channel {
            0 => "tip",
            1 => "internal",
            _ => "root",
        }
    }
}

fn map_nodes_to_image_space(
    peaks: Vec<(usize, usize, usize, f32)>,
    cfg: &ModelConfig,
    resized_w: usize,
    resized_h: usize,
    scale_x: f32,
    scale_y: f32,
    crop_x: u32,
    crop_y: u32,
) -> Vec<PredictedNode> {
    if peaks.is_empty() {
        return Vec::new();
    }

    let mut nodes: Vec<PredictedNode> = peaks
        .into_iter()
        .filter(|(x, y, _, _)| *x < resized_w && *y < resized_h)
        .map(|(x, y, ch, score)| PredictedNode {
            x: (x as f32) / scale_x + crop_x as f32,
            y: (y as f32) / scale_y + crop_y as f32,
            node_type: channel_to_type(ch, cfg).to_string(),
            score,
        })
        .collect();

    if cfg.no_root_pred && cfg.decode.assign_root_leftmost_when_two_classes && nodes.len() > 1 {
        if let Some((idx, _)) = nodes
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal))
        {
            nodes[idx].node_type = "root".to_string();
        }
    }

    nodes
}

fn run_inference(
    model: &NodeModel,
    tensor: Tensor<f32>,
    resized_w: usize,
    resized_h: usize,
    scale_x: f32,
    scale_y: f32,
    crop_x: u32,
    crop_y: u32,
) -> Result<Vec<PredictedNode>> {
    let mut session = model
        .session
        .lock()
        .map_err(|_| "Failed to lock ONNX session".to_string())?;

    let outputs = session
        .run(inputs![tensor])
        .map_err(|e| format!("Inference failed: {e}"))?;

    let first_output = outputs
        .into_iter()
        .next()
        .map(|(_, v)| v)
        .ok_or_else(|| "No outputs returned by the model".to_string())?;

    let (shape, data) = first_output
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Output tensor extraction failed: {e}"))?;

    if shape.len() != 4 {
        return Err(format!("Unexpected output shape: {:?}", &*shape));
    }

    let c = shape[1] as usize;
    let h = shape[2] as usize;
    let w = shape[3] as usize;

    let peaks = decode_peaks(data, c, h, w, &model.config.decode, resized_w, resized_h);

    Ok(map_nodes_to_image_space(
        peaks,
        &model.config,
        resized_w,
        resized_h,
        scale_x,
        scale_y,
        crop_x,
        crop_y,
    ))
}

fn predict_internal_nodes_impl(
    app_handle: &AppHandle,
    merged_png_data: String,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
) -> Result<Vec<PredictedNode>> {
    if crop_w == 0 || crop_h == 0 {
        return Err("Crop dimensions must be greater than zero".into());
    }

    let model = load_model(app_handle)?;
    let config = &model.config;

    let img = decode_data_url_to_image(&merged_png_data)?;
    let cropped = crop_to_rect(&img, crop_x, crop_y, crop_w, crop_h)?;

    let (resized, sx, sy) = resize_keep_aspect(&cropped, config.max_side as u32);
    let resized_w = resized.width() as usize;
    let resized_h = resized.height() as usize;

    let (padded, _pad_w, _pad_h) = pad_to_multiple(&resized, config.pad_multiple as u32);

    let tensor = image_to_tensor(&padded, config.in_channels)?;

    let mut nodes = run_inference(&model, tensor, resized_w, resized_h, sx, sy, crop_x, crop_y)?;

    // Internal-node tool only cares about internal/root predictions.
    nodes.retain(|n| n.node_type == "internal" || n.node_type == "root");

    Ok(nodes)
}

#[tauri::command]
pub async fn predict_internal_nodes(
    app_handle: AppHandle,
    merged_png_data: String,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
) -> Result<Vec<PredictedNode>> {
    let handle = app_handle.clone();
    tauri::async_runtime::spawn_blocking(move || {
        predict_internal_nodes_impl(&handle, merged_png_data, crop_x, crop_y, crop_w, crop_h)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
