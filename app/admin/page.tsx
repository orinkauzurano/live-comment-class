"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const ADMIN_EMAIL = "k-yamawaki@u.shukutoku.ac.jp";

type UserData = {
  id: string;
  email?: string;
  displayName?: string;
  hiddenCommentCount?: number;
  commentMuted?: boolean;
};

type CommentData = {
  id: string;
  text?: string;
  email?: string;
  displayName?: string;
  uid?: string;
  status?: "visible" | "hidden" | "muted";
  createdAt?: {
    toDate: () => Date;
  };
};

type FilterType = "all" | "visible" | "hidden" | "muted";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [users, setUsers] = useState<UserData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "users"), orderBy("email", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserData, "id">),
      }));

      setUsers(data);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, "comments"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<CommentData, "id">),
      }));

      setComments(data);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const mutedUidSet = useMemo(() => {
    return new Set(
      users.filter((u) => u.commentMuted).map((u) => u.id)
    );
  }, [users]);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      const status = mutedUidSet.has(comment.uid || "")
        ? "muted"
        : comment.status || "visible";

      if (filter !== "all" && status !== filter) return false;

      const keyword = searchText.trim().toLowerCase();
      if (!keyword) return true;

      const target = `${comment.text || ""} ${comment.email || ""} ${
        comment.displayName || ""
      }`.toLowerCase();

      return target.includes(keyword);
    });
  }, [comments, filter, searchText, mutedUidSet]);

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const unmuteUser = async (userId: string) => {
    await updateDoc(doc(db, "users", userId), {
      commentMuted: false,
      hiddenCommentCount: 0,
      unmutedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const hideComment = async (commentId: string) => {
    await updateDoc(doc(db, "comments", commentId), {
      status: "hidden",
      hiddenAt: serverTimestamp(),
    });
  };

  const showComment = async (commentId: string) => {
    await updateDoc(doc(db, "comments", commentId), {
      status: "visible",
      restoredAt: serverTimestamp(),
    });
  };

  const formatTime = (comment: CommentData) => {
    if (!comment.createdAt) return "-";

    const date = comment.createdAt.toDate();
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatus = (comment: CommentData) => {
    if (mutedUidSet.has(comment.uid || "")) return "muted";
    return comment.status || "visible";
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        読み込み中...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold">管理者ログイン</h1>
          <button
            onClick={login}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
          >
            Googleアカウントでログイン
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold">管理者専用ページです</h1>
          <p className="mb-4 text-sm text-slate-600">
            現在ログイン中：{user.email}
          </p>
          <button onClick={() => signOut(auth)} className="text-sm underline">
            ログアウト
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">管理画面</h1>
          <div className="text-right text-xs text-slate-500">
            <p>{user.email}</p>
            <button onClick={() => signOut(auth)} className="underline">
              ログアウト
            </button>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">アカウント管理</h2>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-3">状態</th>
                <th className="p-3">メールアドレス</th>
                <th className="p-3">非表示回数</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">
                    {user.commentMuted ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-600">
                        コメント非表示
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-3 py-1 font-bold text-green-600">
                        通常
                      </span>
                    )}
                  </td>

                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.hiddenCommentCount || 0}</td>

                  <td className="p-3">
                    {user.commentMuted && (
                      <button
                        onClick={() => unmuteUser(user.id)}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
                      >
                        解除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">コメント履歴</h2>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              className="w-full rounded-xl border px-4 py-2 md:max-w-md"
              placeholder="メールアドレス・コメント本文で検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "すべて"],
                ["visible", "表示中"],
                ["hidden", "非表示済み"],
                ["muted", "ミュート対象"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as FilterType)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    filter === value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b text-left">
                  <th className="p-3">時刻</th>
                  <th className="p-3">状態</th>
                  <th className="p-3">投稿者</th>
                  <th className="p-3">コメント</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>

              <tbody>
                {filteredComments.map((comment) => {
                  const status = getStatus(comment);

                  return (
                    <tr key={comment.id} className="border-b align-top">
                      <td className="whitespace-nowrap p-3">
                        {formatTime(comment)}
                      </td>

                      <td className="whitespace-nowrap p-3">
                        {status === "visible" && (
                          <span className="rounded-full bg-green-100 px-3 py-1 font-bold text-green-600">
                            表示中
                          </span>
                        )}
                        {status === "hidden" && (
                          <span className="rounded-full bg-slate-200 px-3 py-1 font-bold text-slate-600">
                            非表示済み
                          </span>
                        )}
                        {status === "muted" && (
                          <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-600">
                            ミュート対象
                          </span>
                        )}
                      </td>

                      <td className="max-w-[260px] break-all p-3 text-slate-600">
                        {comment.email || "-"}
                      </td>

                      <td className="p-3 text-base font-medium">
                        {comment.text}
                      </td>

                      <td className="whitespace-nowrap p-3">
                        {comment.status === "hidden" ? (
                          <button
                            onClick={() => showComment(comment.id)}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white"
                          >
                            再表示
                          </button>
                        ) : (
                          <button
                            onClick={() => hideComment(comment.id)}
                            className="rounded-lg bg-slate-700 px-3 py-2 font-bold text-white"
                          >
                            非表示
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}