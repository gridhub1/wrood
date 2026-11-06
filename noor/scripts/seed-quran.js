// تحميل كل سور القرآن إلى مجموعة content.  التشغيل:
//   npm i firebase-admin  &&  GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json node scripts/seed-quran.js
// المصدر: api.alquran.cloud (تأكد من نص المصحف ومن ترخيص أي تفسير تضيفه قبل النشر)
const admin = require("firebase-admin");
admin.initializeApp(); const db = admin.firestore();
(async () => {
  const r = await (await fetch("https://api.alquran.cloud/v1/quran/quran-uthmani")).json();
  const batch = db.batch();
  r.data.surahs.forEach(s => batch.set(db.doc("content/surah-" + s.number), {
    kind: "quran", title: "سورة " + s.name.replace("سُورَةُ ", ""), t: Date.now(),
    text: s.ayahs.map(a => a.text + " ﴿" + a.numberInSurah + "﴾").join(" ") }));
  await batch.commit(); console.log("تم رفع", r.data.surahs.length, "سورة");
})();
