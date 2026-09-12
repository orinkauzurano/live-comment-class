"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";

const SESSION_ID = "oc-2026-09-13";
const RESPONSE_ID_KEY = `ocSnackResponseId:${SESSION_ID}`;

const choices = [
  {
    value: "jagarico",
    label: "じゃがりこ",
    accent: "border-rose-400 bg-rose-50 text-rose-700",
    particle: "#fb7185",
  },
  {
    value: "jagabee",
    label: "Jagabee",
    accent: "border-amber-400 bg-amber-50 text-amber-800",
    particle: "#f59e0b",
  },
  {
    value: "kataage",
    label: "堅あげポテト",
    accent: "border-sky-400 bg-sky-50 text-sky-700",
    particle: "#38bdf8",
  },
] as const;

type Choice = (typeof choices)[number]["value"];

type ParticleBurst = {
  id: number;
  x: number;
  y: number;
  color: string;
};

type FirebaseBundle = {
  db: typeof import("@/lib/firebase")["db"];
  doc: typeof import("firebase/firestore")["doc"];
  serverTimestamp: typeof import("firebase/firestore")["serverTimestamp"];
  setDoc: typeof import("firebase/firestore")["setDoc"];
};

let firebaseBundlePromise: Promise<FirebaseBundle> | null = null;

function prepareFirebase() {
  if (!firebaseBundlePromise) {
    firebaseBundlePromise = Promise.all([
      import("@/lib/firebase"),
      import("firebase/firestore"),
    ]).then(([firebaseModule, firestoreModule]) => ({
      db: firebaseModule.db,
      doc: firestoreModule.doc,
      serverTimestamp: firestoreModule.serverTimestamp,
      setDoc: firestoreModule.setDoc,
    }));
  }

  return firebaseBundlePromise;
}

function createResponseId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function OpenCampusQuizPage() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [responseId, setResponseId] = useState("");
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [bursts, setBursts] = useState<ParticleBurst[]>([]);

  useEffect(() => {
    try {
      let id = localStorage.getItem(RESPONSE_ID_KEY);

      if (!id) {
        id = createResponseId();
        localStorage.setItem(RESPONSE_ID_KEY, id);
      }

      setResponseId(id);
    } catch (storageError) {
      console.warn("回答IDを保存できませんでした。", storageError);
      setResponseId(createResponseId());
    }

    // まずフォームを描画し、その少し後にFirebaseをバックグラウンドで準備します。
    // 利用者が問題文を読んでいる間に読み込みを進めるため、
    // 送信時には多くの場合すでに準備済みになります。
    const preloadTimer = window.setTimeout(() => {
      void prepareFirebase();
    }, 350);

    return () => window.clearTimeout(preloadTimer);
  }, []);

  const triggerParticles = (x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();

    setBursts((prev) => [...prev, { id, x, y, color }]);

    window.setTimeout(() => {
      setBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 850);
  };

  const handleChoiceClick = (
    event: MouseEvent<HTMLButtonElement>,
    value: Choice,
    color: string
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    triggerParticles(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      color
    );

    setChoice(value);
    setSuccessMessage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!choice || !responseId || sending) return;

    const selected = choices.find((item) => item.value === choice);
    if (!selected) return;

    setSending(true);
    setError("");
    setSuccessMessage("");

    try {
      // 通常は画面表示後のバックグラウンド読み込みですでに準備済み。
      // まだ終わっていない場合だけ、ここで残りの読み込みを待ちます。
      const { db, doc, serverTimestamp, setDoc } = await prepareFirebase();

      await setDoc(
        doc(db, "ocSnackResponses", responseId),
        {
          choice: selected.value,
          choiceLabel: selected.label,
          reason: reason.trim(),
          createdAt: serverTimestamp(),
          sessionId: SESSION_ID,
        },
        { merge: true }
      );

      setSubmittedOnce(true);
      setSuccessMessage(
        "送信しました。選び直したり、あとからコメントを追加したりして、何度でも更新できます。"
      );

      // 送信成功時は画面下寄りに少し大きめのキラキラを出す
      triggerParticles(
        window.innerWidth / 2,
        Math.min(window.innerHeight - 90, window.innerHeight * 0.82),
        "#f97316"
      );
    } catch (submitError) {
      console.error(submitError);
      setError(
        "送信できませんでした。通信状況を確認して、もう一度お試しください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-pink-50 via-orange-50 to-sky-50 px-4 py-5 text-slate-800">
      <style jsx global>{`
        @keyframes particle-pop-1 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 46px), calc(-50% - 52px))
              scale(1.05);
          }
        }

        @keyframes particle-pop-2 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 52px), calc(-50% - 42px))
              scale(0.95);
          }
        }

        @keyframes particle-pop-3 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 60px), calc(-50% + 20px))
              scale(0.8);
          }
        }

        @keyframes particle-pop-4 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 58px), calc(-50% + 24px))
              scale(0.9);
          }
        }

        @keyframes particle-pop-5 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 12px), calc(-50% - 70px))
              scale(1.15) rotate(38deg);
          }
        }

        @keyframes particle-pop-6 {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 18px), calc(-50% + 58px))
              scale(0.8) rotate(-34deg);
          }
        }

        .particle-pop-1 {
          animation: particle-pop-1 0.8s ease-out forwards;
        }
        .particle-pop-2 {
          animation: particle-pop-2 0.8s ease-out forwards;
        }
        .particle-pop-3 {
          animation: particle-pop-3 0.8s ease-out forwards;
        }
        .particle-pop-4 {
          animation: particle-pop-4 0.8s ease-out forwards;
        }
        .particle-pop-5 {
          animation: particle-pop-5 0.85s ease-out forwards;
        }
        .particle-pop-6 {
          animation: particle-pop-6 0.85s ease-out forwards;
        }
      `}</style>

      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="pointer-events-none fixed z-[100]"
          style={{ left: burst.x, top: burst.y }}
        >
          <span
            className="particle-pop-1 absolute block h-3 w-3 rounded-full"
            style={{ backgroundColor: burst.color }}
          />
          <span
            className="particle-pop-2 absolute block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: burst.color }}
          />
          <span
            className="particle-pop-3 absolute block h-2 w-2 rounded-full"
            style={{ backgroundColor: burst.color }}
          />
          <span
            className="particle-pop-4 absolute block h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: burst.color }}
          />
          <span className="particle-pop-5 absolute text-2xl">✨</span>
          <span className="particle-pop-6 absolute text-xl">✦</span>
        </div>
      ))}

      <div className="pointer-events-none absolute -left-12 top-12 h-40 w-40 rounded-full bg-pink-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 top-64 h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />

      <form
        onSubmit={submit}
        className="relative mx-auto max-w-md rounded-[32px] bg-white/95 p-5 shadow-xl ring-1 ring-white sm:p-7"
      >
        <div className="text-center">
          <div className="text-5xl">🥔</div>
          <p className="mt-3 text-xs font-black tracking-[0.2em] text-orange-500">
            OPEN CAMPUS QUIZ
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            どの商品だと思う？
          </h1>
          <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
            この中に、20〜30代の働く女性をターゲットに開発された商品があります。どれだと思いますか？
          </p>
        </div>

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">商品を1つ選んでください</legend>

          {choices.map((item) => {
            const selected = choice === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={(event) =>
                  handleChoiceClick(
                    event,
                    item.value,
                    item.particle
                  )
                }
                className={`flex w-full items-center justify-between rounded-2xl border-2 px-5 py-5 text-left text-xl font-black shadow-sm transition duration-150 active:scale-[0.965] ${
                  selected
                    ? `${item.accent} scale-[1.01] shadow-md`
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item.label}
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                    selected
                      ? "border-current scale-110"
                      : "border-slate-300"
                  }`}
                >
                  {selected && (
                    <span className="h-3 w-3 rounded-full bg-current" />
                  )}
                </span>
              </button>
            );
          })}
        </fieldset>

        <label
          className="mt-7 block text-base font-black text-slate-700"
          htmlFor="reason"
        >
          そう思った理由を教えてください
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-400">
            任意
          </span>
        </label>

        <textarea
          id="reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setSuccessMessage("");
          }}
          maxLength={300}
          placeholder="例：パッケージがおしゃれだから"
          className="mt-3 h-28 w-full resize-none rounded-2xl border-0 bg-slate-50 p-4 text-base leading-relaxed outline-none ring-1 ring-slate-200 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-300"
        />

        {successMessage && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-relaxed text-emerald-700 ring-1 ring-emerald-100">
            <p>✓ {successMessage}</p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!choice || !responseId || sending}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 py-4 text-lg font-black text-white shadow-lg shadow-pink-200 transition duration-150 active:scale-[0.98] active:translate-y-px disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
        >
          {sending
            ? "送信中..."
            : submittedOnce
              ? "回答を更新する"
              : "回答を送信する"}
        </button>

        <p className="mt-3 text-center text-xs font-bold leading-relaxed text-slate-400">
          「やっぱりこっち！」と思ったら選び直して再送信できます。
          <br />
          コメントもあとから追加・修正できます。
        </p>
      </form>
    </main>
  );
}
