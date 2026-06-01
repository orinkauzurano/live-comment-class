"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type UserData = {
  id: string;
  email?: string;
  displayName?: string;
  hiddenCommentCount?: number;
  commentMuted?: boolean;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("email", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserData, "id">),
      }));

      setUsers(data);
    });

    return () => unsubscribe();
  }, []);

  const unmuteUser = async (userId: string) => {
    await updateDoc(doc(db, "users", userId), {
      commentMuted: false,
      hiddenCommentCount: 0,
      unmutedAt: new Date(),
    });
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">管理画面</h1>

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
      </div>
    </main>
  );
}