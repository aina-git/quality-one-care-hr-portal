"use client";

import { useRef, type TextareaHTMLAttributes } from "react";
import DictationButton from "./DictationButton";

// Drop-in replacement for <textarea> that adds a microphone button in
// the top-right corner. Same props as the native element — no caller
// changes beyond the tag name. When the operator dictates, the
// component synthesises a native InputEvent so any existing onChange
// handler (controlled forms with value/onChange wiring) keeps working
// without modification.

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function DictatableTextarea({
  className,
  value,
  onChange,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function applyDictatedValue(next: string) {
    const el = ref.current;
    if (!el) return;
    // Use the React-aware native setter so controlled components see
    // the new value through their existing onChange handler.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    if (setter) setter.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={[className, "pr-10"].filter(Boolean).join(" ")}
        value={value}
        onChange={onChange}
        {...rest}
      />
      <div className="absolute right-2 top-2">
        <DictationButton
          value={typeof value === "string" ? value : ""}
          onChange={applyDictatedValue}
          title="Dictate this field"
        />
      </div>
    </div>
  );
}
