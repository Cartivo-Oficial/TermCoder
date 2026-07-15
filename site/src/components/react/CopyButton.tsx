import { useRef } from "react";

interface Props {
  text: string;
}

export default function CopyButton({ text }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    navigator.clipboard.writeText(text).then(() => {
      const b = btnRef.current;
      if (!b) return;
      b.textContent = "Copied";
      setTimeout(() => {
        b.textContent = "Copy";
      }, 1400);
    });
  }

  return (
    <button type="button" className="copy2" ref={btnRef} onClick={handleClick}>
      Copy
    </button>
  );
}
