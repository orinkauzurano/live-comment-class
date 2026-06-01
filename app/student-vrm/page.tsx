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
import VrmCharacter from "./VrmCharacter";

const REACTION_COOLDOWN_MS = 5 * 60 * 1000;
const ALLOWED_DOMAIN = "@u.shukutoku.ac.jp";

type CharacterActionType = "send" | "ok" | "no";

type CharacterAction = {
  type: CharacterActionType;
  nonce: number;
};

export default function StudentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reactionDisabled, setReactionDisabled] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [commentMuted, setCommentMuted] = useState(false);

  const [characterAction, setCharacterAction] = useState<CharacterAction>({
    type: "send",
    nonce: 0,
  });

  const playCharacterAction = (type: CharacterActionType) => {
    setCharacterAction((prev) => ({
      type,
      nonce: prev.nonce + 1,
    }));
  };

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
      playCharacterAction("send");
    } catch (error) {
      console.error(error);
      alert("コメントの送信に失敗しました。もう一度お試しください。");
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

    playCharacterAction(type === "good" ? "ok" : "no");
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-pink-50 to-amber-100 px-3 py-5 sm:px-6">
      <div className="absolute right-3 top-3 max-w-[calc(100%-24px)] truncate rounded-full border border-white/80 bg-white/80 px-3 py-2 text-xs font-bold text-sky-700 shadow-md backdrop-blur sm:right-4 sm:top-4 sm:px-4">
        {user ? `ログイン中：${user.email}` : "未ログイン"}
      </div>

      <div className="mx-auto max-w-md rounded-[28px] border-4 border-white bg-white/90 p-4 shadow-xl shadow-sky-100 sm:p-6">
        <h1 className="mb-4 text-2xl font-black tracking-wide text-sky-700">
          💬 コメント送信
        </h1>

        {!user ? (
          <>
            <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 shadow-sm">
              <p className="font-black">ログイン前の確認</p>
              <p className="mt-1">
                大学Wi-FiではGoogleログインできません。
                スマホのWi-Fiを切り、4G/5G回線でアクセスしてください。
              </p>
            </div>

            <button
              onClick={login}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 font-black text-white shadow-lg shadow-sky-200 active:translate-y-[1px]"
            >
              大学Googleアカウントでログイン
            </button>

            {loginError && (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">
                {loginError}
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              コメントやリアクションを送信するには、大学Googleアカウントでのログインが必要です。
            </p>
          </>
        ) : (
          <>
            {commentMuted && (
              <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">
                このアカウントのコメントは現在スクリーンに表示されません。
              </p>
            )}

            <textarea
              className="h-32 w-full rounded-2xl border-2 border-sky-100 bg-sky-50/40 p-3 text-slate-700 shadow-inner outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
              placeholder="コメントを入力してください"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <button
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 font-black text-white shadow-lg shadow-sky-200 active:translate-y-[1px] disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
              onClick={sendComment}
              disabled={sending || !text.trim()}
            >
              {sending ? "送信中..." : "送信する"}
            </button>

            <div className="mt-6 border-t-2 border-dashed border-sky-100 pt-5">
              <p className="mb-3 text-sm font-black text-sky-700">
                🌟 リアクション
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendReaction("good")}
                  disabled={reactionDisabled}
                  className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 py-3 font-black text-white shadow-md shadow-emerald-100 active:translate-y-[1px] disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                >
                  👍 OK
                </button>

                <button
                  onClick={() => sendReaction("question")}
                  disabled={reactionDisabled}
                  className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 font-black text-white shadow-md shadow-amber-100 active:translate-y-[1px] disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                >
                  ❓ わからない
                </button>
              </div>

              <div className="mt-2 h-[220px] w-full overflow-visible">
                <VrmCharacter action={characterAction} />
              </div>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="mt-4 text-sm font-bold text-slate-500 underline underline-offset-2"
            >
              ログアウト
            </button>
          </>
        )}

        <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-xs leading-relaxed text-slate-500">
          <p className="font-black text-sky-700">注意事項</p>
          <p className="mt-1">
            投稿内容は匿名でスクリーンに表示されます。メールアドレス等の個人情報が他の学生に公開されることはありません。
          </p>
          <p className="mt-1">
            不適切な投稿や授業運営を妨げる投稿が確認された場合は、管理者が投稿者を確認できる仕組みになっています。
          </p>
          <p className="mt-1">
            不適切コメントが複数回見られたアカウントは、以降コメントがスクリーンに表示されません。ただし、管理者は投稿内容を確認できます。
          </p>
        </div>
      </div>
    </main>
  );
}