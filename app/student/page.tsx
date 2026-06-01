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

export default function StudentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reactionDisabled, setReactionDisabled] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [commentMuted, setCommentMuted] = useState(false);

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

    await addDoc(collection(db, "comments"), {
      text: text.trim(),
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      createdAt: serverTimestamp(),
      status: commentMuted ? "muted" : "visible",
    });

    setText("");
    setSending(false);
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
  };

  return (
    <main className="relative min-h-screen bg-slate-100 p-6">
      <div className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-xs shadow">
        {user ? `ログイン中：${user.email}` : "未ログイン"}
      </div>

      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold">コメント送信</h1>

        {!user ? (
          <>
            <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
              <p className="font-bold">ログイン前の確認</p>
              <p className="mt-1">
                大学Wi-FiではGoogleログインできません。
                スマホのWi-Fiを切り、4G/5G回線でアクセスしてください。
              </p>
            </div>

            <button
              onClick={login}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white"
            >
              大学Googleアカウントでログイン
            </button>

            {loginError && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">
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
              <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">
                このアカウントのコメントは現在スクリーンに表示されません。
              </p>
            )}

            <textarea
              className="h-32 w-full rounded-xl border p-3"
              placeholder="コメントを入力してください"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <button
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:bg-gray-400"
              onClick={sendComment}
              disabled={sending}
            >
              {sending ? "送信中..." : "送信する"}
            </button>

            <div className="mt-6 border-t pt-5">
              <p className="mb-3 text-sm font-bold text-slate-600">
                リアクション
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendReaction("good")}
                  disabled={reactionDisabled}
                  className="rounded-xl bg-emerald-500 py-3 font-bold text-white disabled:bg-gray-300 disabled:text-gray-500"
                >
                  👍 OK
                </button>

                <button
                  onClick={() => sendReaction("question")}
                  disabled={reactionDisabled}
                  className="rounded-xl bg-amber-500 py-3 font-bold text-white disabled:bg-gray-300 disabled:text-gray-500"
                >
                  ❓ わからない
                </button>
              </div>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="mt-5 text-sm text-slate-500 underline"
            >
              ログアウト
            </button>
          </>
        )}

        <div className="mt-6 border-t pt-4 text-xs leading-relaxed text-slate-500">
          <p className="font-bold">注意事項</p>
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