"use client";

import { useId, useRef, useState } from "react";

export function ResponseJson({ data }: { data: unknown }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        查看原始 JSON
      </button>
      <dialog
        ref={dialog}
        className="response-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        <div className="response-dialog-header">
          <h2 id={titleId}>原始 JSON 回應</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            關閉
          </button>
        </div>
        {open && <pre tabIndex={0}>{JSON.stringify(data, null, 2)}</pre>}
      </dialog>
    </>
  );
}
