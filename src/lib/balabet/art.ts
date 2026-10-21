import { useEffect, useState } from "react";

const KEY = "balabet-art-v1";
export const DEFAULT_CANDY = "/assets/bala.jpg";
export const DEFAULT_LOLLIPOP = "/assets/pirulito.jpg";

type Art = { candy: string | null; lollipop: string | null };

function read(): Art {
  if (typeof window === "undefined") return { candy: null, lollipop: null };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Art | null;
    if (!parsed || typeof parsed !== "object") return { candy: null, lollipop: null };
    return {
      candy: typeof parsed.candy === "string" ? parsed.candy : null,
      lollipop: typeof parsed.lollipop === "string" ? parsed.lollipop : null,
    };
  } catch {
    return { candy: null, lollipop: null };
  }
}

export function useArt() {
  const [art, setArt] = useState<Art>({ candy: null, lollipop: null });
  useEffect(() => {
    setArt(read());
  }, []);
  const candy = art.candy ?? DEFAULT_CANDY;
  const lollipop = art.lollipop ?? DEFAULT_LOLLIPOP;
  function save(next: Art) {
    localStorage.setItem(KEY, JSON.stringify(next));
    setArt(next);
  }
  return {
    candy,
    lollipop,
    customized: Boolean(art.candy || art.lollipop),
    async setFile(kind: "candy" | "lollipop", file: File | null) {
      if (!file) {
        save({ ...read(), [kind]: null });
        return null;
      }
      if (!file.type.startsWith("image/")) return "Envie um arquivo de imagem.";
      if (file.size > 700_000) return "Use uma imagem de até 700 KB.";
      const dataUrl = await file.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return `data:${file.type};base64,${btoa(binary)}`;
      });
      save({ ...read(), [kind]: dataUrl });
      return null;
    },
    resetArt() {
      localStorage.removeItem(KEY);
      setArt({ candy: null, lollipop: null });
    },
  };
}
