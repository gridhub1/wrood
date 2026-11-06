const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore(), inc = admin.firestore.FieldValue.increment;
const need = a => { if (!a) throw new HttpsError("unauthenticated", "سجّل الدخول"); };

// الإجابة على سؤال: الإجابة الصحيحة تُحفظ في answers (لا يقرؤها المتصفح)
exports.answer = onCall(async ({ auth, data }) => {
  need(auth);
  const a = (await db.doc("answers/" + data.qid).get()).data();
  if (!a) throw new HttpsError("not-found", "سؤال غير موجود");
  const ok = data.choice === a.correct;
  const user = db.doc("users/" + auth.uid), done = user.collection("done").doc(data.qid);
  await db.runTransaction(async t => {
    if ((await t.get(done)).exists) return;           // النقاط مرة واحدة لكل سؤال
    t.set(done, { ok, at: Date.now() });
    if (ok) t.update(user, { points: inc(a.points || 10), correct: inc(1) });
  });
  return { ok, correct: a.correct };
});

// مساعدة: تُخصم 5 نقاط وتُخفي إجابتين خاطئتين
exports.hint = onCall(async ({ auth, data }) => {
  need(auth);
  const q = (await db.doc("questions/" + data.qid).get()).data();
  const a = (await db.doc("answers/" + data.qid).get()).data();
  if (!q || !a) throw new HttpsError("not-found", "سؤال غير موجود");
  const user = db.doc("users/" + auth.uid), h = user.collection("hints").doc(data.qid);
  return db.runTransaction(async t => {
    const old = await t.get(h);
    if (old.exists) return { hide: old.data().hide };
    const u = (await t.get(user)).data();
    if ((u.points || 0) < 5) throw new HttpsError("failed-precondition", "نقاطك لا تكفي");
    const wrong = q.o.map((_, i) => i).filter(i => i !== a.correct);
    const hide = wrong.sort(() => Math.random() - .5).slice(0, Math.max(0, q.o.length - 2));
    t.set(h, { hide }); t.update(user, { points: inc(-5) });
    return { hide };
  });
});

// هدية نقاط من المالك فقط (أي عدد)
exports.gift = onCall(async ({ auth, data }) => {
  need(auth);
  if (!(await db.doc("admins/" + auth.uid).get()).exists) throw new HttpsError("permission-denied", "للمالك فقط");
  const n = Number(data.amount);
  if (!data.uid || !Number.isFinite(n)) throw new HttpsError("invalid-argument", "بيانات خاطئة");
  await db.doc("users/" + data.uid).update({ points: inc(n) });
  await db.collection("users/" + data.uid + "/notifs").add({ from: "owner", text: `🎁 جاتك هدية من المالك: ${n} نقطة`, t: Date.now() });
  return { ok: true };
});
