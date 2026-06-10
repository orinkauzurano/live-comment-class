"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const ALLOWED_DOMAIN = "@u.shukutoku.ac.jp";
const QUIZ_ID = "financial_literacy_2025_25";

type QuizQuestion = {
  id: number;
  sourceQuestion: string;
  question: string;
  choices: string[];
  correctIndex: number;
};

type AnswerValue = number;

const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    sourceQuestion: "Q4",
    question:
      "家計の行動に関する次の記述のうち、適切でないものはどれでしょうか。",
    choices: [
      "家計簿などで、収支を管理する",
      "本当に必要か、収入はあるかなどを考えたうえで、支出をするかどうかを判断する",
      "収入のうち、一定額を天引きにするなどの方法により、貯蓄を行う",
      "支払を遅らせるため、クレジットカードの分割払を多用する",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 2,
    sourceQuestion: "Q5",
    question:
      "家計管理やクレジットカードに関する次の記述のうち、適切でないものはどれでしょうか。",
    choices: [
      "クレジットカードを自分の収入に合わせて計画的に利用する",
      "クレジットカードの未決済額は、実質的には借金である",
      "手数料（金利）負担は、リボルビング払いでは生じるが、分割払いでは生じない",
      "利用代金を支払わないと、以降のカード使用ができなくなることがある",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 3,
    sourceQuestion: "Q12",
    question:
      "AさんとBさんは同い年です。Aさんは25歳の時に年10万円の預金を始め、その後、毎年10万円を50年間預金し続けました。一方、Bさんは25歳の時には預金をせず、50歳の時に年20万円の預金を始め、その後、毎年20万円を25年間預金し続けました。二人が75歳になったとき、どちらの預金残高が多いでしょうか。",
    choices: [
      "預け入れた金額は全く同じのため、二人の預金残高は同じである",
      "各年に預け入れた金額が多いため、Bさんの預金残高の方が多い",
      "預け入れた金額が多いため、Aさんの預金残高の方が多い",
      "複利で利子がつく期間が長いため、Aさんの預金残高の方が多い",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 4,
    sourceQuestion: "Q13",
    question:
      "生活設計（ライフプランニング）に関する次の記述のうち、適切でないものはどれでしょうか。",
    choices: [
      "ライフステージの変化を踏まえて、資金計画をたてる",
      "保険は将来のリスクに備える手段のひとつである",
      "医療・介護制度を理解することは、生活設計の役に立つ",
      "ライフプランは、一度決めたら見直すべきではない",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 5,
    sourceQuestion: "Q14",
    question:
      "契約を行う際の対応として、適切でないものはどれでしょうか。",
    choices: [
      "自分にとって、その契約が本当に必要なのかを、改めて考える",
      "解約できるかどうかや、解約時に違約金が発生するかを確認する",
      "業者から詳しく説明を聞いて契約し、契約書は後でゆっくり読む",
      "契約締結に当たり、必要に応じて、第三者にアドバイスを求める",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 6,
    sourceQuestion: "Q15",
    question:
      "金融トラブルに巻き込まれないための行動として、適切でないものはどれでしょうか。",
    choices: [
      "自分の個人情報はなるべく言わない",
      "金融経済に関する知識を身に付けるよう努力する",
      "判断に迷ったときは、業者を信じて一任する",
      "購入しようとする商品の評判をインターネットで確認する",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 7,
    sourceQuestion: "Q16",
    question:
      "インターネット取引において、適切でないものはどれでしょうか。",
    choices: [
      "セキュリティ対策ソフトを最新版にした",
      "メールが届いたが、心当たりのないアドレスだったので、開かなかった",
      "インターネットカフェのパソコンを使って銀行振込をした",
      "入力事項に間違いがないか、何度も確認した",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 8,
    sourceQuestion: "Q18",
    question:
      "100万円を年率2％の利息がつく預金口座に預け入れました。それ以外、この口座への入金や出金がなかった場合、1年後、口座の残高はいくらになっているでしょうか。利息にかかる税金は考慮しないでご回答ください。",
    choices: ["100万円", "101万円", "102万円", "104万円", "わからない"],
    correctIndex: 2,
  },
  {
    id: 9,
    sourceQuestion: "Q19",
    question:
      "100万円を年率2％の利息がつく預金口座に預け入れました。それ以外、この口座への入金や出金がなかった場合、5年後には口座の残高はいくらになっているでしょうか。利息にかかる税金は考慮しないでご回答ください。",
    choices: [
      "110万円より多い",
      "ちょうど110万円",
      "110万円より少ない",
      "上記の条件だけでは答えられない",
      "わからない",
    ],
    correctIndex: 0,
  },
  {
    id: 10,
    sourceQuestion: "Q20",
    question:
      "インフレ率が2％で、普通預金口座であなたが受け取る利息が1％なら、1年後にこの口座のお金を使ってどれくらいの物を購入することができると思いますか。",
    choices: [
      "今日以上に物が買える",
      "今日と全く同じだけ物が買える",
      "今日以下しか物が買えない",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 11,
    sourceQuestion: "Q21-1",
    question:
      "次の文章が正しいかどうかをご回答ください。高インフレの時には、生活に使うものやサービスの値段全般が急速に上昇する。",
    choices: ["正しい", "間違っている", "わからない"],
    correctIndex: 0,
  },
  {
    id: 12,
    sourceQuestion: "Q21-2",
    question:
      "次の文章が正しいかどうかをご回答ください。住宅ローンを組む場合、返済期間が15年の場合と30年の場合を比較すると、通常、15年の方が月々の支払い額は多くなるが、支払う金利の総額は少なくなる。",
    choices: ["正しい", "間違っている", "わからない"],
    correctIndex: 0,
  },
  {
    id: 13,
    sourceQuestion: "Q21-3",
    question:
      "次の文章が正しいかどうかをご回答ください。平均以上の高いリターンのある投資には、平均以上の高いリスクがあるものだ。",
    choices: ["正しい", "間違っている", "わからない"],
    correctIndex: 0,
  },
  {
    id: 14,
    sourceQuestion: "Q21-4",
    question:
      "次の文章が正しいかどうかをご回答ください。1社の株を買うことは、通常、株式投資信託を買うよりも安全な投資である。なお、株式投資信託とは、何社かの株式に投資する金融商品です。",
    choices: ["正しい", "間違っている", "わからない"],
    correctIndex: 1,
  },
  {
    id: 15,
    sourceQuestion: "Q22",
    question: "金利が上がったら、通常、債券価格はどうなるでしょうか。",
    choices: [
      "上がる",
      "下がる",
      "変化しない",
      "債券価格と金利の間には何の関係もない",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 16,
    sourceQuestion: "Q23",
    question:
      "金利が上がっていくときに、資金の運用（預貯金等）、借入れについて適切な対応はどれでしょうか。",
    choices: [
      "運用は固定金利、借入れは固定金利にする",
      "運用は固定金利、借入れは変動金利にする",
      "運用は変動金利、借入れは固定金利にする",
      "運用は変動金利、借入れは変動金利にする",
      "わからない",
    ],
    correctIndex: 2,
  },
  {
    id: 17,
    sourceQuestion: "Q25",
    question:
      "保険の基本的な働きに関する次の記述のうち、適切なものはどれでしょうか。",
    choices: [
      "リスクの発生頻度は高いが、発生すると損失が大きい場合に有効である",
      "リスクの発生頻度は低いが、発生すると損失が大きい場合に有効である",
      "リスクの発生頻度は高いが、発生すると損失が小さい場合に有効である",
      "リスクの発生頻度は低いが、発生すると損失が小さい場合に有効である",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 18,
    sourceQuestion: "Q26",
    question:
      "子供が独立した55歳の世帯主が生命保険を見直す場合、適切なものはどれでしょうか。他の事情に変化はないものとします。",
    choices: [
      "死亡保障の増額を検討する",
      "死亡保障の減額を検討する",
      "特に見直す必要はない",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 19,
    sourceQuestion: "Q28",
    question: "保険に関する以下の記述のうち、適切でないものはどれでしょうか。",
    choices: [
      "学生であっても20歳以上になると国民年金保険料を納める必要がある",
      "自動車事故を起こした場合の損害賠償は、自賠責保険により全額カバーされる",
      "生命保険は、自分や家族の変化に合わせて必要性や保障額を見直すことが望ましい",
      "医療保険では、加入前に発症した病気について補償されないことがある",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 20,
    sourceQuestion: "Q30",
    question: "住宅ローンに関する以下の記述のうち、適切なものを選択してください。",
    choices: [
      "ローンを組んで住宅を購入するよりも、生涯賃貸住宅に住み続ける方が、圧倒的に資金負担が小さい",
      "住宅ローンの返済方法には、元利均等方式と元金均等方式があるが、総返済額はどちらも同じである",
      "住宅ローンの金利タイプには変動金利型や固定金利型があるが、固定金利型の方が変動金利型よりも常に有利である",
      "住宅ローンにかかる総返済額を減らすためには、頭金をできるだけ多く用意するとともに、可能な範囲で繰り上げ返済を行うのが有効である",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 21,
    sourceQuestion: "Q31",
    question:
      "10万円の借入れがあり、借入金利は複利で年率20％です。返済をしないと、この金利では、何年で残高は倍になるでしょうか。",
    choices: [
      "2年未満",
      "2年以上5年未満",
      "5年以上10年未満",
      "10年以上",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 22,
    sourceQuestion: "Q33",
    question:
      "預金保険制度で1千万円まで保護される預金の種類に関する次の記述のうち、適切なものはどれでしょうか。",
    choices: [
      "普通預金だけが保護される",
      "普通預金と定期預金は保護される",
      "普通預金、定期預金、外貨預金など全ての種類の預金が保護される",
      "自己責任の原則から、いかなる預金も保護されない",
      "わからない",
    ],
    correctIndex: 1,
  },
  {
    id: 23,
    sourceQuestion: "Q36",
    question:
      "聞いたことがない金融商品を購入するかどうかを判断する際の行動や考え方として、適切でないものはどれでしょうか。",
    choices: [
      "トラブルが多発し、公的機関から注意喚起がなされていないか、情報を収集する",
      "インターネットや書籍、複数の販売業者から情報を収集し、他の商品と比較する",
      "中立的な立場から情報提供を行っている機関等に相談し、アドバイスを受ける",
      "販売業者から高いリターンが期待できるとの情報が得られれば、商品を購入する",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 24,
    sourceQuestion: "Q37",
    question:
      "複雑な仕組みの金融商品の購入を検討するにあたって、適切な対応はどれでしょうか。",
    choices: [
      "仕組みがよくわからなくても、売れ行きが良ければ購入する",
      "仕組みがよくわからなくても、提供している金融機関が信用できれば購入する",
      "仕組みがよくわからなくても、高いリターンが期待できれば購入する",
      "仕組みを理解できて問題ないと思えば購入する",
      "わからない",
    ],
    correctIndex: 3,
  },
  {
    id: 25,
    sourceQuestion: "Q38",
    question:
      "金融商品の契約についてトラブルが発生した際に利用する相談窓口や制度として、適切でないものはどれでしょうか。",
    choices: ["消費生活センター", "金融ADR制度", "格付会社", "弁護士"],
    correctIndex: 2,
  },
];

function getLiteracyLevel(score100: number) {
  if (score100 <= 20) {
    return {
      level: 1,
      label: "低リテラシー",
      range: "0〜20点",
      message: "まずは家計管理・契約・金利など、基本項目から確認していきましょう。",
    };
  }

  if (score100 <= 40) {
    return {
      level: 2,
      label: "低リテラシー",
      range: "21〜40点",
      message: "基礎知識にまだ不安があります。金融商品の説明をうのみにしない姿勢が大切です。",
    };
  }

  if (score100 <= 60) {
    return {
      level: 3,
      label: "中リテラシー",
      range: "41〜60点",
      message: "基本は少しずつ押さえられています。リスク・金利・保険の考え方を補強しましょう。",
    };
  }

  if (score100 <= 80) {
    return {
      level: 4,
      label: "中リテラシー",
      range: "61〜80点",
      message: "かなり理解できています。複雑な金融商品や長期の資産形成まで考えられる段階です。",
    };
  }

  return {
    level: 5,
    label: "高リテラシー",
    range: "81〜100点",
    message: "金融知識・判断力はかなり高めです。知識を実際の行動にどう活かすかが次のポイントです。",
  };
}

export default function StudentQuizPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    correctCount: number;
    total: number;
    score100: number;
    percentage: number;
    level: number;
    literacyLabel: string;
    literacyRange: string;
    literacyMessage: string;
  } | null>(null);

  const currentQuestion = quizQuestions[currentIndex];
  const isLastQuestion = currentIndex === quizQuestions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === quizQuestions.length;
  const selectedAnswer = answers[currentQuestion.id];

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
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

      setLoginError("");
      setUser(currentUser);
    });
  }, []);

  const isCorrectAnswer = (
    question: QuizQuestion,
    answer: AnswerValue | undefined
  ) => {
    if (answer === undefined) return false;
    return answer === question.correctIndex;
  };

  const answerDetails = useMemo(() => {
    return quizQuestions.map((question) => {
      const answer = answers[question.id];
      const correct = isCorrectAnswer(question, answer);

      return {
        questionId: question.id,
        sourceQuestion: question.sourceQuestion,
        question: question.question,
        answer,
        answerLabel:
          typeof answer === "number" ? question.choices[answer] ?? "" : "",
        correct,
        correctIndex: question.correctIndex,
        correctAnswer: question.choices[question.correctIndex],
      };
    });
  }, [answers]);

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

  const selectChoice = (choiceIndex: number) => {
    if (result) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: choiceIndex,
    }));
  };

  const goNext = () => {
    if (answers[currentQuestion.id] === undefined) {
      alert("選択肢を選んでください。");
      return;
    }

    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const gradeQuiz = async () => {
    if (!user) return;

    if (!allAnswered) {
      alert("未回答の問題があります。最後まで回答してください。");
      return;
    }

    setSaving(true);

    try {
      const correctCount = answerDetails.filter((item) => item.correct).length;
      const total = quizQuestions.length;
      const score100 = correctCount * 4;
      const percentage = score100;
      const levelInfo = getLiteracyLevel(score100);

      await setDoc(
        doc(db, "quizResults", user.uid),
        {
          quizId: QUIZ_ID,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          correctCount,
          total,
          score100,
          percentage,
          level: levelInfo.level,
          literacyLabel: levelInfo.label,
          literacyRange: levelInfo.range,
          answers: answerDetails,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setResult({
        correctCount,
        total,
        score100,
        percentage,
        level: levelInfo.level,
        literacyLabel: levelInfo.label,
        literacyRange: levelInfo.range,
        literacyMessage: levelInfo.message,
      });
    } catch (error) {
      console.error(error);
      alert(
        "結果の保存に失敗しました。Firebaseのルールやログイン状態を確認してください。"
      );
    } finally {
      setSaving(false);
    }
  };

  const jumpToUnanswered = () => {
    const firstUnansweredIndex = quizQuestions.findIndex(
      (question) => answers[question.id] === undefined
    );

    if (firstUnansweredIndex >= 0) {
      setCurrentIndex(firstUnansweredIndex);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 via-orange-50 to-sky-50 px-4 py-6 text-slate-800">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-white/70 bg-white/90 p-6 text-center shadow-xl">
            <div className="mb-3 text-4xl">💰</div>
            <h1 className="text-xl font-bold">金融リテラシークイズ</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              大学のGoogleアカウントでログインしてから回答してください。
            </p>

            {loginError && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {loginError}
              </p>
            )}

            <button
              onClick={login}
              className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 text-base font-bold text-white shadow-lg active:scale-95"
            >
              Googleでログイン
            </button>

            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              ログインできない場合は、大学Wi-Fiを切って4G/5G回線でお試しください。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 via-orange-50 to-sky-50 px-4 py-6 text-slate-800">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-white/70 bg-white/95 p-6 text-center shadow-xl">
            <div className="mb-3 text-5xl">🎉</div>
            <h1 className="text-xl font-bold">採点結果</h1>

            <div className="mt-6 rounded-3xl bg-sky-50 px-4 py-6">
              <p className="text-sm font-bold text-slate-500">あなたの点数</p>
              <p className="mt-2 text-6xl font-black text-sky-600">
                {result.score100}
                <span className="text-2xl text-slate-500"> 点</span>
              </p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {result.correctCount}問正解 / {result.total}問中
              </p>
            </div>

            <div className="mt-5 rounded-3xl bg-pink-50 px-4 py-5">
              <p className="text-sm font-bold text-slate-500">
                レベル{result.level}：{result.literacyRange}
              </p>
              <p className="mt-2 text-2xl font-black text-pink-600">
                {result.literacyLabel}
              </p>
              <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
                {result.literacyMessage}
              </p>
            </div>

            <div className="mt-5 rounded-3xl bg-orange-50 px-4 py-4 text-left">
            <p className="text-sm font-bold leading-relaxed text-orange-700">
                この点数はあとで授業内で使うので、覚えておいてください。
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
                コメントページに進んだら、終わった人はコメントで「終わった！」って送ってくれると嬉しいです。
            </p>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-600">
            回答結果を保存しました。このあと、いつものコメントページに進めます。
            </p>

            <button
              onClick={() => router.push("/student")}
              className="mt-6 w-full rounded-2xl bg-pink-500 px-5 py-4 text-base font-bold text-white shadow-lg active:scale-95"
            >
              コメントページへ進む
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-orange-50 to-sky-50 px-4 py-4 text-slate-800">
      <div className="mx-auto max-w-md">
        <header className="mb-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500">
                金融リテラシークイズ
              </p>
              <h1 className="text-lg font-black">
                第{currentIndex + 1}問 / {quizQuestions.length}問
              </h1>
            </div>

            <div className="rounded-full bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">
              回答済み {answeredCount}/{quizQuestions.length}
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{
                width: `${((currentIndex + 1) / quizQuestions.length) * 100}%`,
              }}
            />
          </div>
        </header>

        <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              Q{currentQuestion.id}
            </p>
            <p className="text-xs font-bold text-slate-400">
              元設問：{currentQuestion.sourceQuestion}
            </p>
          </div>

          <h2 className="text-lg font-black leading-relaxed">
            {currentQuestion.question}
          </h2>

          <div className="mt-6 space-y-3">
            {currentQuestion.choices.map((choice, index) => {
              const selected = selectedAnswer === index;

              return (
                <button
                  key={`${currentQuestion.id}-${choice}`}
                  onClick={() => selectChoice(index)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left text-sm font-bold leading-relaxed shadow-sm transition active:scale-[0.98] ${
                    selected
                      ? "border-sky-400 bg-sky-100 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span className="mr-2 text-slate-400">
                    {String.fromCharCode(9312 + index)}
                  </span>
                  {choice}
                </button>
              );
            })}
          </div>
        </section>

        <footer className="mt-4 flex gap-3">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="flex-1 rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-600 shadow-md disabled:opacity-40"
          >
            前の問題へ
          </button>

          {!isLastQuestion ? (
            <button
              onClick={goNext}
              disabled={answers[currentQuestion.id] === undefined}
              className="flex-1 rounded-2xl bg-sky-500 px-4 py-4 text-sm font-bold text-white shadow-md disabled:opacity-40"
            >
              次の問題へ
            </button>
          ) : (
            <button
              onClick={gradeQuiz}
              disabled={!allAnswered || saving}
              className="flex-1 rounded-2xl bg-pink-500 px-4 py-4 text-sm font-bold text-white shadow-md disabled:opacity-40"
            >
              {saving ? "保存中..." : "採点する"}
            </button>
          )}
        </footer>

        {!allAnswered && isLastQuestion && (
          <button
            onClick={jumpToUnanswered}
            className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-orange-600 shadow-md"
          >
            未回答の問題へ戻る
          </button>
        )}

        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          選択肢を選んだあと、「次の問題へ」を押してください。戻って回答を変更することもできます。
        </p>
      </div>
    </main>
  );
}