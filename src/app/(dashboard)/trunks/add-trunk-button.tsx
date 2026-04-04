"use client";

import { useState } from "react";
import TrunkForm from "./trunk-form";

export default function AddTrunkButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-xyra-500/25 transition hover:bg-xyra-600"
      >
        + Add Trunk
      </button>
      {open && <TrunkForm onClose={() => setOpen(false)} />}
    </>
  );
}
