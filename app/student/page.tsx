"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const REACTION_COOLDOWN_MS = 5 * 60 * 1000;
const ALLOWED_DOMAIN = "@u.shukutoku.ac.jp";

type EffectType = "sparkle" | "good" | "question";

type FloatingEffect = {
  id: number;
  type: EffectType;
};

export default function StudentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reactionDisabled, setReactionDisabled] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [commentMuted, setCommentMuted] = useState(false);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setCommentMuted(false);
        return;
      }

      const email = currentUser.email || "";

      if (!email.endsWith(ALLOWED_DOMAIN)) {
        setUser(null);
        setLoginError(
          "大学のGoogleアカウント（@u.shukutoku.ac.jp）でログインしてください。"
        );
        await signOut(auth);
        return;
      }

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      setCommentMuted(userDoc.data()?.commentMuted === true);

      setLoginError("");
      setUser(currentUser);
    });
  }, []);

  useEffect(() => {
    const checkCooldown = () => {
      const now = Date.now();
      const lastReactionAt = Number(localStorage.getItem("lastReactionAt") || 0);
      setReactionDisabled(now - lastReactionAt < REACTION_COOLDOWN_MS);
    };

    checkCooldown();
    const timer = setInterval(checkCooldown, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerEffect = (type: EffectType) => {
    const id = Date.now() + Math.random();

    setEffects((prev) => [...prev, { id, type }]);

    setTimeout(() => {
      setEffects((prev) => prev.filter((effect) => effect.id !== id));
    }, 1400);
  };

  const login = async () => {
    try {
      setLoginError("");
      googleProvider.setCustomParameters({ hd: "u.shukutoku.ac.jp" });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert("ログインに失敗しました。Wi-Fiを切って再度お試しください。");
    }
  };

  const sendComment = async () => {
    if (!user || !user.email?.endsWith(ALLOWED_DOMAIN) || !text.trim()) return;

    setSending(true);

    try {
      await addDoc(collection(db, "comments"), {
        text: text.trim(),
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: serverTimestamp(),
        status: commentMuted ? "muted" : "visible",
      });

      setText("");
      triggerEffect("sparkle");
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (type: "good" | "question") => {
    if (!user || !user.email?.endsWith(ALLOWED_DOMAIN) || reactionDisabled)
      return;

    await addDoc(collection(db, "reactions"), {
      type,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
    });

    localStorage.setItem("lastReactionAt", String(Date.now()));
    setReactionDisabled(true);

    triggerEffect(type);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-pink-50 via-orange-50 to-sky-50 px-3 py-4 text-slate-800">
      <style jsx>{`
        @keyframes sparkle-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.5) rotate(-8deg);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -8px) scale(1.15) rotate(5deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -80px) scale(1.45) rotate(16deg);
          }
        }

        @keyframes icon-float {
          0% {
            opacity: 0;
            transform: translate(-50%, 20px) scale(0.5);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -4px) scale(1.2);
          }
          55% {
            transform: translate(-50%, -36px) scale(1.05) rotate(4deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -90px) scale(1.25) rotate(-5deg);
          }
        }

        .sparkle-pop {
          animation: sparkle-pop 1.4s ease-out forwards;
        }

        .icon-float {
          animation: icon-float 1.4s ease-out forwards;
        }
      `}</style>

      {effects.map((effect) => (
        <div
          key={effect.id}
          className={`pointer-events-none fixed left-1/2 top-[42%] z-50 select-none text-center ${
            effect.type === "sparkle" ? "sparkle-pop" : "icon-float"
          }`}
        >
          {effect.type === "sparkle" && (
            <div className="flex items-center justify-center gap-2 text-5xl drop-shadow">
              <span>✨</span>
              <span className="text-4xl">🌟</span>
              <span>✨</span>
            </div>
          )}

          {effect.type === "good" && (
            <div className="rounded-full bg-white/90 px-6 py-4 text-6xl shadow-xl ring-4 ring-emerald-100">
              👍
            </div>
          )}

          {effect.type === "question" && (
            <div className="rounded-full bg-white/90 px-6 py-4 text-6xl shadow-xl ring-4 ring-amber-100">
              ❓
            </div>
          )}
        </div>
      ))}

      <div className="pointer-events-none absolute -left-12 top-10 h-32 w-32 rounded-full bg-pink-200/40 blur-2xl" />
      <div className="pointer-events-none absolute -right-10 top-40 h-36 w-36 rounded-full bg-sky-200/50 blur-2xl" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl" />

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col">
        <div className="mb-2 flex justify-end">
          <div className="max-w-[78%] truncate rounded-full bg-white/75 px-3 py-1 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-white/80 backdrop-blur">
            {user ? `ログイン中：${user.email}` : "未ログイン"}
          </div>
        </div>

        <div className="relative flex-1 rounded-[28px] bg-white/90 p-5 shadow-xl ring-1 ring-white/80 backdrop-blur">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-200 to-amber-200 text-2xl shadow-sm">
              💬
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              コメント送信
            </h1>
            <p className="mt-1 text-xs font-bold text-slate-400">
              授業中のコメント・リアクションはこちら
            </p>
          </div>

          {!user ? (
            <>
              <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-100">
                <p className="font-black">ログイン前の確認</p>
                <p className="mt-1">
                  大学Wi-FiではGoogleログインできません。
                  スマホのWi-Fiを切り、4G/5G回線でアクセスしてください。
                </p>
              </div>

              <button
                onClick={login}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 py-3.5 font-black text-white shadow-lg shadow-sky-200 active:translate-y-[1px]"
              >
                大学Googleアカウントでログイン
              </button>

              {loginError && (
                <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
                  {loginError}
                </p>
              )}

              <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                コメントやリアクションを送信するには、大学Googleアカウントでのログインが必要です。
              </p>
            </>
          ) : (
            <>
              {commentMuted && (
                <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
                  このアカウントのコメントは現在スクリーンに表示されません。
                </p>
              )}

              <div className="rounded-3xl bg-gradient-to-br from-pink-50 to-orange-50 p-3 ring-1 ring-pink-100">
                <textarea
                  className="h-32 w-full resize-none rounded-2xl border-0 bg-white/90 p-4 text-base leading-relaxed text-slate-700 shadow-inner outline-none ring-1 ring-pink-100 placeholder:text-slate-300 focus:ring-2 focus:ring-pink-200"
                  placeholder="コメントを入力してください"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />

                <button
                  className="mt-3 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 py-3.5 font-black text-white shadow-lg shadow-pink-200 transition active:translate-y-[1px] disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none"
                  onClick={sendComment}
                  disabled={sending || !text.trim()}
                >
                  {sending ? "送信中..." : "送信する ✨"}
                </button>
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="mb-3 text-sm font-black text-slate-600">
                  リアクション
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => sendReaction("good")}
                    disabled={reactionDisabled}
                    className="rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 py-4 font-black text-white shadow-lg shadow-emerald-100 transition active:translate-y-[1px] disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none"
                  >
                    <span className="block text-2xl">👍</span>
                    <span className="mt-1 block text-sm">OK</span>
                  </button>

                  <button
                    onClick={() => sendReaction("question")}
                    disabled={reactionDisabled}
                    className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 py-4 font-black text-white shadow-lg shadow-amber-100 transition active:translate-y-[1px] disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none"
                  >
                    <span className="block text-2xl">❓</span>
                    <span className="mt-1 block text-sm">わからない</span>
                  </button>
                </div>

                {reactionDisabled && (
                  <p className="mt-3 text-center text-[11px] font-bold text-slate-400">
                    リアクションは少し時間を空けて送れます
                  </p>
                )}
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => signOut(auth)}
                  className="text-xs font-bold text-slate-400 underline underline-offset-2"
                >
                  ログアウト
                </button>
              </div>
            </>
          )}

          <div className="mt-5 rounded-2xl bg-white/70 p-3 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-100">
            <p className="font-black text-slate-600">注意事項</p>
            <p className="mt-1">
              投稿内容は匿名でスクリーンに表示されます。メールアドレス等の個人情報が他の学生に公開されることはありません。
            </p>
            <p className="mt-1">
              不適切な投稿や授業運営を妨げる投稿が確認された場合は、管理者が投稿者を確認できる仕組みになっています。
            </p>
            <p className="mt-1">
              不適切コメントが複数回見られたアカウントは、以降コメントがスクリーンに表示されません。管理者は投稿内容を確認できます。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}