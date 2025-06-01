import { useEffect, RefObject, Dispatch, SetStateAction } from "react";

/**
 * Close a pop-up menu when the user clicks anywhere outside it.
 *
 * @param ref     element that contains the menu
 * @param isOpen  current open/closed state
 * @param setOpen setter returned by useState
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement>,
  isOpen: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        isOpen &&
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen, ref, setOpen]);
}
