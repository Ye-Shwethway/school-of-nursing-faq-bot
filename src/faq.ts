export type Language = "my" | "en" | "zh";

export type FaqEntry = {
  key: string;
  question: Record<Language, string>;
  answer: Record<Language, string>;
  keywords: Record<Language, string[]>;
};

export const FAQS: FaqEntry[] = [
  {
    key: "official-info-channel",
    question: {
      my: "ကျောင်းအကြောင်းကို ဘယ်မှာ အသေးစိတ် စုံစမ်းရမလဲရှင့်။",
      en: "Where can I get detailed information about the school?",
      zh: "我可以在哪里详细了解学校信息？",
    },
    answer: {
      my: "ကျောင်းတက်ရောက်ခွင့် လျှောက်ထားခြင်း၊ သတင်းအချက်အလက်များနှင့် နောက်ဆုံးရကြေညာချက်များကို အချိန်နဲ့တပြေးညီ သိရှိနိုင်ရန် @sr1schoolofnursing တရားဝင် Telegram Channel သို့ ဝင်ရောက် စုံစမ်းမေးမြန်းနိုင်ပါသည်။",
      en: "For admission applications, information, and the latest announcements, please use the official Telegram channel @sr1schoolofnursing.",
      zh: "如需了解入学申请、学校信息及最新公告，请关注官方 Telegram 频道 @sr1schoolofnursing。",
    },
    keywords: {
      my: ["ကျောင်းအကြောင်း", "အသေးစိတ်", "စုံစမ်း", "telegram", "channel"],
      en: ["school information", "details", "official channel", "telegram"],
      zh: ["学校信息", "详细", "官方频道", "telegram"],
    },
  },
  {
    key: "teaching-language",
    question: {
      my: "သူနာပြုတက္ကသိုလ်မှာ ဘယ်ဘာသာစကားနဲ့ သင်ကြားမှာလဲ။",
      en: "What language is used for teaching?",
      zh: "学校使用什么语言授课？",
    },
    answer: {
      my: "သင်ခန်းစာများ၊ ပို့ချချက်များနှင့် သင်ရိုးညွှန်းတမ်းစာအုပ်များအားလုံးကို မြန်မာဘာသာနှင့် အင်္ဂလိပ်ဘာသာ (၂) ဘာသာ အသုံးပြု၍ သင်ကြားပေးမှာဖြစ်ပါတယ်။",
      en: "Lessons, lectures, and curriculum materials are taught using both Burmese and English.",
      zh: "课程、讲座和教材将使用缅甸语和英语两种语言进行教学。",
    },
    keywords: {
      my: ["ဘာသာစကား", "သင်ကြား", "မြန်မာ", "အင်္ဂလိပ်"],
      en: ["language", "teaching", "burmese", "english"],
      zh: ["语言", "授课", "缅甸语", "英语"],
    },
  },
  {
    key: "eligibility",
    question: {
      my: "ဘယ်လိုလူတွေ တက်ရောက်လျှောက်ထားလို့ရလဲ။",
      en: "Who is eligible to apply?",
      zh: "哪些人可以申请？",
    },
    answer: {
      my: "အခြေခံပညာအထက်တန်းစာမေးပွဲ စနစ်ဟောင်း (Grade-11) သို့မဟုတ် စနစ်သစ် (Grade-12) စစ်ဆေးမှုတွင် သိပ္ပံတွဲဖြင့် အောင်မြင်ထားသူများ၊ IGCSE သို့မဟုတ် GED အောင်မြင်ထားသူများအပြင် အခြားသူနာပြုတက္ကသိုလ် သို့မဟုတ် သူနာပြုသင်တန်းကျောင်းများတွင် အကြောင်းအမျိုးမျိုးကြောင့် ကျောင်းခေတ္တရပ်နားထားသူများလည်း ပြန်လည်တက်ရောက်ရန် လျှောက်ထားနိုင်ပါသည်။",
      en: "Applicants may include students who passed old-system Grade 11 or new-system Grade 12 with the science combination, IGCSE or GED graduates, and students who previously paused study at another nursing university or nursing school and wish to resume.",
      zh: "可申请者包括：以理科组合通过旧制 Grade 11 或新制 Grade 12 的学生、IGCSE 或 GED 毕业生，以及因各种原因曾在其他护理大学或护理学校暂停学业、希望继续学习的学生。",
    },
    keywords: {
      my: ["လျှောက်ထား", "grade-11", "grade-12", "igcse", "ged", "သိပ္ပံတွဲ"],
      en: ["eligible", "apply", "grade 11", "grade 12", "igcse", "ged", "science"],
      zh: ["申请", "资格", "grade 11", "grade 12", "igcse", "ged", "理科"],
    },
  },
  {
    key: "entrance-exam-process",
    question: {
      my: "ဝင်ခွင့်စာမေးပွဲ (Entrance Exam) ဖြေဆိုရမှာလား။",
      en: "Do I need to take an entrance exam?",
      zh: "需要参加入学考试吗？",
    },
    answer: {
      my: "ဝင်ခွင့်စာမေးပွဲကို အွန်လိုင်းမှတဆင့် ၂ ရက်ခွဲ၍ ဖြေဆိုရမှာ ဖြစ်ပါတယ်။ ၂၀၂၆ ခုနှစ် September 15 ရက်နေ့တွင် အင်္ဂလိပ်စာ ရေးဖြေစာမေးပွဲ၊ September 16 ရက်နေ့တွင် Physics, Chemistry, Biology ရေးဖြေစာမေးပွဲ ဖြေဆိုရမည်ဖြစ်ပြီး ရေးဖြေအောင်မြင်သူများကို အွန်လိုင်းမှတဆင့် Interview ဆက်လက်ပြုလုပ်သွားမှာ ဖြစ်ပါတယ်။",
      en: "Yes. The entrance exam is conducted online across two days: English on September 15, 2026, and Physics, Chemistry, and Biology on September 16, 2026. Candidates who pass the written exams will proceed to an online interview.",
      zh: "需要。入学考试分两天在线进行：2026 年 9 月 15 日考英语，9 月 16 日考物理、化学和生物。笔试合格者将继续参加线上面试。",
    },
    keywords: {
      my: ["ဝင်ခွင့်စာမေးပွဲ", "entrance exam", "ရေးဖြေ", "interview", "september 15", "september 16"],
      en: ["entrance exam", "written exam", "interview", "september 15", "september 16"],
      zh: ["入学考试", "笔试", "面试", "9月15", "9月16"],
    },
  },
  {
    key: "on-campus-study",
    question: {
      my: "အွန်လိုင်းကနေ တက်ရမှာလား၊ ကျောင်း campus မှာ တက်ရမှာလား။",
      en: "Is the program online or on campus?",
      zh: "课程是线上还是到校学习？",
    },
    answer: {
      my: "ကျောင်းသို့ ကိုယ်တိုင်လာရောက်၍ စာတွေ့၊ ကျောင်းတွင်းလက်တွေ့နှင့် ဆေးရုံလက်တွေ့များကို မပျက်မကွက် တက်ရောက်ရမည့် On-Campus သင်တန်းအမျိုးအစား ဖြစ်ပါတယ်။",
      en: "It is an on-campus program. Students must attend classroom teaching, on-campus practical training, and hospital clinical practice in person.",
      zh: "这是到校学习的课程。学生必须亲自参加课堂教学、校内实训和医院临床实习。",
    },
    keywords: {
      my: ["online", "on-campus", "campus", "ကျောင်းဝင်း", "လက်တွေ့"],
      en: ["online", "on campus", "campus", "clinical", "practical"],
      zh: ["线上", "到校", "校园", "临床", "实习"],
    },
  },
  {
    key: "duration",
    question: {
      my: "ဘယ်နှစ်နှစ် တက်ရောက်ရမှာလဲ။",
      en: "How many years is the program?",
      zh: "课程需要学习几年？",
    },
    answer: {
      my: "ကျောင်းဝင်းအတွင်း နေထိုင်ကာ အချိန်ပြည့်စနစ်ဖြင့် ၄ နှစ် တက်ရောက်ရမှာ ဖြစ်ပါတယ်။",
      en: "The program is a four-year full-time on-campus course.",
      zh: "该课程为四年制全日制到校学习项目。",
    },
    keywords: {
      my: ["ဘယ်နှစ်နှစ်", "၄ နှစ်", "4 years", "အချိန်ပြည့်"],
      en: ["how many years", "duration", "four years", "4 years"],
      zh: ["几年", "四年", "4年", "学制"],
    },
  },
  {
    key: "application-method",
    question: {
      my: "ဘယ်လိုပုံစံမျိုးနဲ့ လျှောက်ထားရမလဲ။",
      en: "How do I apply?",
      zh: "如何申请？",
    },
    answer: {
      my: "Google Form သို့မဟုတ် PDF file မှတဆင့် အချက်အလက်ပြည့်စုံစွာ ဖြည့်စွက်၍ အွန်လိုင်းမှတဆင့် လျှောက်ထားနိုင်ပါသည်။\n\nStudent Application (Google Form):\nhttps://docs.google.com/forms/d/e/1FAIpQLScJhR7t-GQK_z-AvpwbAo5rDTdqyLR6z8ZzivD0lWfJwfPKjQ/viewform?usp=sharing\n\nStudent Application (PDF Form):\nhttps://drive.google.com/file/d/1q4K8UqiWVIOOnpFHRIxv_BTWEOAKVPRy/view?usp=sharing",
      en: "You can apply online by completing either the Google Form or the PDF application form.\n\nGoogle Form:\nhttps://docs.google.com/forms/d/e/1FAIpQLScJhR7t-GQK_z-AvpwbAo5rDTdqyLR6z8ZzivD0lWfJwfPKjQ/viewform?usp=sharing\n\nPDF Form:\nhttps://drive.google.com/file/d/1q4K8UqiWVIOOnpFHRIxv_BTWEOAKVPRy/view?usp=sharing",
      zh: "可在线填写 Google Form 或 PDF 申请表进行申请。\n\nGoogle Form：\nhttps://docs.google.com/forms/d/e/1FAIpQLScJhR7t-GQK_z-AvpwbAo5rDTdqyLR6z8ZzivD0lWfJwfPKjQ/viewform?usp=sharing\n\nPDF 申请表：\nhttps://drive.google.com/file/d/1q4K8UqiWVIOOnpFHRIxv_BTWEOAKVPRy/view?usp=sharing",
    },
    keywords: {
      my: ["လျှောက်ထား", "google form", "pdf", "application"],
      en: ["how apply", "application", "google form", "pdf"],
      zh: ["如何申请", "申请表", "google form", "pdf"],
    },
  },
  {
    key: "monthly-cost",
    question: {
      my: "ကျောင်းလခနဲ့ အခြားကုန်ကျစရိတ်တွေ ဘယ်လောက်ရှိမလဲ။",
      en: "How much are tuition and other monthly costs?",
      zh: "学费和其他每月费用是多少？",
    },
    answer: {
      my: "တစ်လကုန်ကျစရိတ်မှာ ကျောင်းလခ ၂၀၀ ယွမ်၊ စားစရိတ် (မနက်၊ နေ့လယ်၊ ည) ၄၀၀ ယွမ်၊ အဆောင်နှင့် ရေ/မီး ၅၀ ယွမ် ဖြစ်ပြီး စုစုပေါင်း ၆၅၀ ယွမ် ကျသင့်ပါသည်။ Source document တွင် လက်ရှိငွေလဲနှုန်းအရ မြန်မာငွေကျပ် ၄၀၀,၀၀၀ မှ ၄၅၀,၀၀၀ ဝန်းကျင်ဟု ဖော်ပြထားပါသည်။ Interview အောင်ပြီးပါက သတ်မှတ်ချက်နှင့်အညီ Scholarship သို့မဟုတ် Loan program များ လျှောက်ထားနိုင်ပါသည်။",
      en: "The listed monthly cost is 650 CNY total: 200 CNY tuition, 400 CNY meals, and 50 CNY for accommodation plus water/electricity. The source document estimates about MMK 400,000–450,000 at the then-current exchange rate. Scholarship or loan programs may be available after passing the interview, subject to eligibility conditions.",
      zh: "每月总费用为 650 元人民币：学费 200 元、三餐 400 元、住宿及水电 50 元。原始文件按当时汇率估算约为 400,000–450,000 缅币。面试通过后，可根据相关条件申请奖学金或贷款计划。",
    },
    keywords: {
      my: ["ကျောင်းလခ", "ကုန်ကျစရိတ်", "၆၅၀", "650", "ယွမ်", "အဆောင်", "စားစရိတ်"],
      en: ["tuition", "cost", "650", "cny", "meals", "accommodation"],
      zh: ["学费", "费用", "650", "人民币", "住宿", "餐费"],
    },
  },
  {
    key: "accreditation",
    question: {
      my: "သင်တန်းဆင်းရင် အသိအမှတ်ပြုလက်မှတ်နဲ့ လိုင်စင် (Accreditation) ရရှိမှာလား။",
      en: "Will graduates receive accreditation and a nursing license?",
      zh: "毕业后能获得认证和护理执照吗？",
    },
    answer: {
      my: "ဒေသတွင်းအသိအမှတ်ပြုမှုအနေဖြင့် ကြားဖြတ်ဖက်ဒရယ်သူနာပြုနှင့် သားဖွားကောင်စီ (IFNMC) မှ တရားဝင်အသိအမှတ်ပြု သူနာပြုလိုင်စင်အား ဖြေဆိုအောင်မြင်ပါက ရရှိမှာဖြစ်ပြီး၊ နိုင်ငံတကာအသိအမှတ်ပြုမှုရရှိနိုင်ရန် ကမ္ဘာ့ဆေးပညာပညာရေးအဖွဲ့ချုပ် (WFME) သို့ လက်ရှိတွင် လျှောက်ထားဆဲဖြစ်ပါသည်။",
      en: "For regional recognition, graduates can obtain the officially recognized nursing license from the Interim Federal Nursing and Midwifery Council (IFNMC) after passing its licensing examination. The school is currently applying to the World Federation for Medical Education (WFME) in relation to international recognition.",
      zh: "在地区认可方面，通过临时联邦护理与助产委员会（IFNMC）的执照考试后，可获得其正式认可的护理执照。学校目前也正在向世界医学教育联合会（WFME）申请与国际认可相关的认证。",
    },
    keywords: {
      my: ["accreditation", "လိုင်စင်", "အသိအမှတ်ပြု", "ifnmc", "wfme"],
      en: ["accreditation", "license", "ifnmc", "wfme", "recognition"],
      zh: ["认证", "执照", "ifnmc", "wfme", "认可"],
    },
  },
  {
    key: "cdm-entrance-exam",
    question: {
      my: "CDM ကျောင်းသူ/သားတွေရော ဝင်ခွင့်စာမေးပွဲ ပြန်ဖြေရမှာလား။",
      en: "Do CDM nursing students need to retake the entrance written exam?",
      zh: "CDM 护理学生需要重新参加入学笔试吗？",
    },
    answer: {
      my: "CDM သူနာပြုကျောင်းသူ/သားများက ဝင်ခွင့်စာမေးပွဲ ရေးဖြေ ပြန်ဖြေစရာမလိုပါ။ Interview နှုတ်ဖြေစာမေးပွဲသာ ဖြေဆိုရမှာ ဖြစ်ပါတယ်။",
      en: "CDM nursing students do not need to retake the written entrance examination. They only need to take the interview/oral examination.",
      zh: "CDM 护理学生无需重新参加入学笔试，只需参加面试/口试。",
    },
    keywords: {
      my: ["cdm", "ဝင်ခွင့်", "ပြန်ဖြေ", "interview"],
      en: ["cdm", "retake", "entrance", "interview"],
      zh: ["cdm", "重新考试", "入学", "面试"],
    },
  },
  {
    key: "bond-self-funded",
    question: {
      my: "ကျောင်းပြီးရင် နိုင်ငံ့ဝန်ထမ်းအဖြစ် ပြန်လည်တာဝန်ထမ်းဆောင်ရမည့် စာချုပ် (Bond) ရှိပါသလား။",
      en: "Is there a service bond after graduation?",
      zh: "毕业后有服务期合同（Bond）吗？",
    },
    answer: {
      my: "ကျောင်းလခနှင့် နေစရိတ်၊ စားစရိတ်များကို လစဉ်ပုံမှန် ပေးသွင်းတက်ရောက်သူများအတွက် Bond မရှိပါ။ သို့သော် အထူးဒေသ-၁ (SR-1) တွင် အရေးပေါ်ကျန်းမာရေးစောင့်ရှောက်မှု လိုအပ်ချက်ရှိလာပါက ဝိုင်းဝန်းကူညီ တာဝန်ထမ်းဆောင်နိုင်ရပါမည်။ အစိုးရထောက်ပံ့ကြေး သို့မဟုတ် ချေးငွေရယူသူများအတွက် သတ်မှတ်ထားသော Bond ရှိပါမည်။",
      en: "There is no bond for students who pay tuition, accommodation, and meal costs normally each month. However, they may be expected to assist if emergency healthcare needs arise in SR-1. Students receiving government grants or loans are subject to the applicable bond conditions.",
      zh: "按月正常自行支付学费、住宿费和餐费的学生没有固定服务期合同。但如果 SR-1 出现紧急医疗需求，学生应能够协助服务。获得政府资助或贷款的学生则需遵守相应的服务期合同条件。",
    },
    keywords: {
      my: ["bond", "စာချုပ်", "ဝန်ထမ်း", "ထောက်ပံ့ကြေး", "ချေးငွေ"],
      en: ["bond", "service", "contract", "government grant", "loan"],
      zh: ["bond", "服务期", "合同", "资助", "贷款"],
    },
  },
  {
    key: "scholarship-loan",
    question: {
      my: "ပညာသင်ဆု (Scholarship) ဒါမှမဟုတ် အစိုးရထောက်ပံ့ကြေး လျှောက်ထားလို့ရနိုင်မလား။",
      en: "Can I apply for a scholarship or government financial support?",
      zh: "可以申请奖学金或政府资助吗？",
    },
    answer: {
      my: "Entrance exam အောင်မြင်ပြီးပါက လျှောက်ထားနိုင်ပါတယ်။ အစိုးရဘဏ္ဍာရေးကူညီမှုစနစ် ၃ မျိုးရှိပါတယ်။\n\n1) Full Tuition Grant with Bond — ကုန်ကျစရိတ် 100% ထောက်ပံ့ပြီး ပြန်ဆပ်ရန်မလိုပါ။ ကျောင်းပြီးပါက SR-1 ကျန်းမာရေးဌာနများတွင် ၅ နှစ်တာဝန်ထမ်းဆောင်ရပါမည်။ Zero-Failure Policy ဖြစ်ပြီး စာမေးပွဲကျရှုံးပါက Loan စနစ်သို့ ပြောင်းသတ်မှတ်မည်။\n\n2) Half Tuition Grant with Bond — ကုန်ကျစရိတ် 50% ကို အစိုးရမှ ထောက်ပံ့ပြီး ကျန် 50% ကို မိသားစုဘက်မှ တာဝန်ယူရပါမည်။ ကျောင်းပြီးပါက ဒေသတွင်း သို့မဟုတ် ဖွံ့ဖြိုးမှုနောက်ကျသော မိမိနေရပ်ဒေသတွင် ၃ နှစ်တာဝန်ထမ်းဆောင်ရပါမည်။ စာမေးပွဲကျရှုံးပါက Scholarship ရုပ်သိမ်းမည်။\n\n3) Tuition Fee with Government Loan — ကျောင်းစရိတ်အားလုံးကို အစိုးရမှ ချေးငွေအဖြစ် စိုက်ထုတ်ပေးမည်။ ကျောင်းပြီးပါက SR-1 တွင် ၅ နှစ် တာဝန်ထမ်းဆောင်ရပြီး ချေးယူထားသောငွေကို လစာမှ ၃ နှစ်အတွင်း အရစ်ကျပြန်ဆပ်ရပါမည်။",
      en: "Yes, after passing the entrance exam. Three government support options are listed:\n\n1) Full Tuition Grant with Bond — 100% of costs are covered and do not need to be repaid, but graduates must serve for 5 years in SR-1 health departments. It follows a zero-failure policy; failing an exam converts the arrangement to the regular loan system.\n\n2) Half Tuition Grant with Bond — the government covers 50% and the family covers the remaining 50%. Graduates must serve for 3 years in the assigned local area or their underdeveloped home region. The scholarship is withdrawn if the student fails an exam.\n\n3) Tuition Fee with Government Loan — the government advances all school costs as a loan. After graduation, the student serves for 5 years in SR-1 and repays the borrowed amount from salary in installments over 3 years.",
      zh: "可以，前提是通过入学考试。文件列出三种政府资助方式：\n\n1）全额奖学金 + 服务期合同：政府承担 100% 费用，无需偿还；毕业后须在 SR-1 医疗部门服务 5 年。实行零挂科政策，若考试不及格，将转为普通贷款计划。\n\n2）半额奖学金 + 服务期合同：政府承担 50%，家庭承担 50%；毕业后须在当地或本人发展相对落后的家乡地区服务 3 年。若考试不及格，奖学金将被取消。\n\n3）政府学生贷款：政府先行承担全部学校费用，毕业后须在 SR-1 服务 5 年，并在 3 年内从工资中分期偿还所借金额。",
    },
    keywords: {
      my: ["scholarship", "ပညာသင်ဆု", "loan", "ချေးငွေ", "ထောက်ပံ့", "100%", "50%"],
      en: ["scholarship", "loan", "grant", "financial support", "100%", "50%"],
      zh: ["奖学金", "贷款", "资助", "100%", "50%"],
    },
  },
  {
    key: "entrance-exam-date",
    question: {
      my: "ဝင်ခွင့်စာမေးပွဲကို ဘယ်တော့လောက် ဖြေဆိုရမှာလဲ။",
      en: "When is the entrance exam?",
      zh: "入学考试什么时候举行？",
    },
    answer: {
      my: "၁၅.၉.၂၀၂၆ တွင် English စာမေးပွဲကို Online စနစ်ဖြင့် ရေးဖြေပြီး၊ ၁၆.၉.၂၀၂၆ တွင် Physics, Chemistry, Biology စာမေးပွဲများကို Online စနစ်ဖြင့် ရေးဖြေရပါမည်။",
      en: "The English online written exam is on September 15, 2026. Physics, Chemistry, and Biology online written exams are on September 16, 2026.",
      zh: "英语线上笔试安排在 2026 年 9 月 15 日；物理、化学和生物线上笔试安排在 2026 年 9 月 16 日。",
    },
    keywords: {
      my: ["ဘယ်တော့", "ဝင်ခွင့်စာမေးပွဲ", "၁၅.၉.၂၀၂၆", "၁၆.၉.၂၀၂၆"],
      en: ["when", "entrance exam", "september 15", "september 16"],
      zh: ["什么时候", "入学考试", "9月15", "9月16"],
    },
  },
  {
    key: "entrance-exam-preparation",
    question: {
      my: "ဝင်ခွင့်စာမေးပွဲအတွက် ဘာတွေ ပြင်ဆင်လေ့လာထားရမလဲ။",
      en: "What should I study to prepare for the entrance exam?",
      zh: "入学考试需要准备哪些内容？",
    },
    answer: {
      my: "Application Guide ကို သေချာလေ့လာထားရပါမယ်။\nhttps://drive.google.com/file/d/1CQZrHfJZu_IPJ7b6QTObGTLuSRboTKSR/view?usp=sharing",
      en: "Please study the Application Guide carefully:\nhttps://drive.google.com/file/d/1CQZrHfJZu_IPJ7b6QTObGTLuSRboTKSR/view?usp=sharing",
      zh: "请认真阅读并学习 Application Guide：\nhttps://drive.google.com/file/d/1CQZrHfJZu_IPJ7b6QTObGTLuSRboTKSR/view?usp=sharing",
    },
    keywords: {
      my: ["ပြင်ဆင်", "လေ့လာ", "application guide", "ဝင်ခွင့်စာမေးပွဲ"],
      en: ["prepare", "study", "application guide", "entrance exam"],
      zh: ["准备", "学习", "application guide", "入学考试"],
    },
  },
  {
    key: "opening-date",
    question: {
      my: "ကျောင်းက ဘယ်တော့ စဖွင့်မှာလဲ။",
      en: "When will the school open?",
      zh: "学校什么时候开学？",
    },
    answer: {
      my: "သူနာပြုသိပ္ပံကျောင်းကို ၂၀၂၆ ခုနှစ် အောက်တိုဘာလတွင် စတင်ဖွင့်လှစ်မှာ ဖြစ်ပါတယ်။ ဝင်ခွင့်အောင်မြင်ပြီး ကျောင်းတက်ခွင့်ရရှိသူများကို ကျောင်းဖွင့်မည့်ရက် မတိုင်မီ အနည်းဆုံး ၂ ပတ် ကြိုတင်၍ အကြောင်းကြားပေးသွားမှာ ဖြစ်ပါတယ်။",
      en: "The School of Nursing is scheduled to open in October 2026. Successful applicants will be notified at least two weeks before the opening date.",
      zh: "护理学校计划于 2026 年 10 月开学。获得入学资格的学生将在正式开学日期前至少两周收到通知。",
    },
    keywords: {
      my: ["ဘယ်တော့", "စဖွင့်", "အောက်တိုဘာ", "2026"],
      en: ["when open", "opening", "october 2026", "start"],
      zh: ["什么时候开学", "开学", "2026年10月"],
    },
  },
  {
    key: "career-after-graduation",
    question: {
      my: "ကျောင်းပြီးရင် အလုပ်ချက်ချင်းရမှာလား။",
      en: "Will I get a job immediately after graduation?",
      zh: "毕业后会马上有工作吗？",
    },
    answer: {
      my: "ကျောင်းပြီးဆုံးပါက အထူးဒေသ-၁ (SR-1) ကျန်းမာရေးဌာန၊ အခြားတိုင်းရင်းသားဒေသများနှင့် နိုင်ငံခြားတိုင်းပြည်အချို့ရှိ ကျန်းမာရေးလုပ်ငန်းခွင်များတွင် အလုပ်အကိုင် ပြန်လည်လျှောက်ထားနိုင်မှာ ဖြစ်ပါတယ်။ သူနာပြုဘာသာရပ်နှင့် ဆက်နွယ်သော Further Study များအတွက်လည်း ကျောင်းမှ ကူညီချိတ်ဆက် ဆောင်ရွက်ပေးသွားမှာ ဖြစ်ပါတယ်။",
      en: "After graduation, students may apply for healthcare jobs in SR-1, other ethnic regions, and some overseas settings. The school also plans to help connect graduates with further-study opportunities related to nursing.",
      zh: "毕业后，学生可申请 SR-1、其他民族地区以及部分海外地区的医疗相关岗位。学校也将协助对接护理相关的继续深造机会。",
    },
    keywords: {
      my: ["အလုပ်", "ကျောင်းပြီး", "အလုပ်အကိုင်", "further study"],
      en: ["job", "after graduation", "career", "further study"],
      zh: ["工作", "毕业后", "就业", "继续深造"],
    },
  },
  {
    key: "pay-in-mmk",
    question: {
      my: "ကျောင်းလခကို မြန်မာငွေနဲ့ ပေးသွင်းလို့ရပါသလား။",
      en: "Can tuition be paid in Myanmar kyat?",
      zh: "学费可以用缅币支付吗？",
    },
    answer: {
      my: "ဟုတ်ကဲ့၊ လွှဲပြောင်းပေးသွင်းနိုင်ပါတယ်။ ကျောင်းလခကို ပေးသွင်းမည့်လ၏ ပြင်ပပေါက်ဈေး တရုတ်ယွမ်ငွေလဲနှုန်းအပေါ် မူတည်ပြီး မြန်မာငွေဖြင့် တွက်ချက်ကာ လွှဲပေးရမှာ ဖြစ်ပါတယ်။",
      en: "Yes. Payment can be transferred in Myanmar kyat, calculated using the prevailing external-market CNY exchange rate for the month of payment.",
      zh: "可以。可按付款当月市场上的人民币汇率折算为缅币后进行转账支付。",
    },
    keywords: {
      my: ["မြန်မာငွေ", "ကျောင်းလခ", "ငွေလဲနှုန်း", "ယွမ်"],
      en: ["myanmar kyat", "mmk", "tuition", "exchange rate", "cny"],
      zh: ["缅币", "学费", "汇率", "人民币"],
    },
  },
  {
    key: "married-applicants",
    question: {
      my: "အိမ်ထောင်ရှိသူတွေကော လျှောက်ထားလို့ရလား။",
      en: "Can married applicants apply?",
      zh: "已婚申请者可以申请吗？",
    },
    answer: {
      my: "ဟုတ်ကဲ့၊ အိမ်ထောင်ရှိသော်လည်း လျှောက်ထားတက်ရောက်နိုင်ပါတယ်။ သို့သော် ကျောင်းတက်ရောက်ပညာသင်ကြားနေစဉ် ၄ နှစ်တာကာလအတွင်း ကိုယ်ဝန်ဆောင်ခြင်းကို ခွင့်ပြုမည် မဟုတ်ပါ။",
      en: "Yes, married applicants may apply. However, the source policy states that pregnancy is not permitted during the four years of study.",
      zh: "可以，已婚申请者也可申请。但原始政策规定，在四年学习期间不允许怀孕。",
    },
    keywords: {
      my: ["အိမ်ထောင်", "လျှောက်ထား", "ကိုယ်ဝန်", "၄ နှစ်"],
      en: ["married", "apply", "pregnancy", "four years"],
      zh: ["已婚", "申请", "怀孕", "四年"],
    },
  },
  {
    key: "missing-certificates",
    question: {
      my: "ဆယ်တန်းအောင်လက်မှတ်နဲ့ အမှတ်စာရင်း မရှိတော့ရင်ကော လျှောက်လို့ရမလား။",
      en: "Can I apply if my high-school certificate or marksheet is missing?",
      zh: "如果高中毕业证或成绩单遗失，还可以申请吗？",
    },
    answer: {
      my: "ဟုတ်ကဲ့၊ လျှောက်ထားနိုင်ပါတယ်။ မိမိတက်ရောက်အောင်မြင်ခဲ့သော အထက်တန်းကျောင်းမှ ခုံနံပါတ် သို့မဟုတ် ကျောင်းထောက်ခံစာတစ်စုံတစ်ရာ တင်ပြပေးပို့ပြီး လျှောက်ထားရမှာ ဖြစ်ပါတယ်။",
      en: "Yes. You may apply by submitting your examination seat number or another supporting/verification letter from the high school you attended and passed.",
      zh: "可以。可提交本人原高中考试座位号，或由原就读并毕业的高中出具的相关证明材料进行申请。",
    },
    keywords: {
      my: ["အောင်လက်မှတ်", "အမှတ်စာရင်း", "မရှိ", "ခုံနံပါတ်", "ထောက်ခံစာ"],
      en: ["certificate missing", "marksheet missing", "seat number", "school letter"],
      zh: ["毕业证遗失", "成绩单遗失", "座位号", "学校证明"],
    },
  },
  {
    key: "school-region-restriction",
    question: {
      my: "အခြေခံပညာအထက်တန်းကို ဘယ်ကျောင်းက အောင်မြင်ခဲ့သည်ဖြစ်စေ လျှောက်ထားလို့ရပါသလား။",
      en: "Can I apply regardless of which high school or region I graduated from?",
      zh: "无论毕业于哪所高中或哪个地区都可以申请吗？",
    },
    answer: {
      my: "ဟုတ်ကဲ့၊ မိမိအောင်မြင်ခဲ့သည့် ကျောင်း သို့မဟုတ် ဒေသအပေါ် ကန့်သတ်ချက်မရှိဘဲ၊ အခြေခံပညာအထက်တန်းအဆင့် စာမေးပွဲကို သိပ္ပံတွဲဖြင့် အောင်မြင်ထားသူ မည်သူမဆို တန်းတူ လျှောက်ထားနိုင်ပါသည်။",
      en: "Yes. There is no restriction based on the school or region you graduated from, provided you passed the basic high-school examination with the science combination.",
      zh: "可以。对毕业学校或地区没有限制，只要通过基础高中阶段的理科组合考试，就可以平等申请。",
    },
    keywords: {
      my: ["ဘယ်ကျောင်း", "ဘယ်ဒေသ", "ကန့်သတ်ချက်", "သိပ္ပံတွဲ"],
      en: ["which school", "region", "restriction", "science"],
      zh: ["哪所学校", "地区", "限制", "理科"],
    },
  },
  {
    key: "academic-year-breaks",
    question: {
      my: "Academic year နှင့် ကျောင်းပိတ်ရက် အကြောင်း",
      en: "How are the academic year and school breaks structured?",
      zh: "学年和假期是如何安排的？",
    },
    answer: {
      my: "ပညာသင်နှစ် ၄ နှစ်ရှိပြီး တစ်နှစ်လျှင် Semester ၂ ခု ဖြင့် ဖွဲ့စည်းထားပါသည်။ First Semester ပြီးဆုံးတိုင်း Semester Break အဖြစ် ၁၀ ရက်မှ ၂ ပတ်အထိ ကျောင်းပိတ်ရက်ရှိပြီး၊ Second Semester (Academic Year End) ပြီးဆုံးတိုင်း Annual Vacation အဖြစ် ၃ ပတ်မှ ၁ လအထိ ကျောင်းပိတ်ရက် သတ်မှတ်ပေးမည် ဖြစ်ပါသည်။",
      en: "The program lasts four academic years, with two semesters per year. After the first semester there is a semester break of about 10 days to 2 weeks. After the second semester (end of the academic year), there is an annual vacation of about 3 weeks to 1 month.",
      zh: "课程共四个学年，每年两个学期。第一学期结束后有约 10 天至 2 周的学期间假；第二学期（学年结束）后有约 3 周至 1 个月的年度假期。",
    },
    keywords: {
      my: ["academic year", "semester", "ကျောင်းပိတ်ရက်", "break", "vacation"],
      en: ["academic year", "semester", "break", "vacation", "holiday"],
      zh: ["学年", "学期", "假期", "semester", "vacation"],
    },
  },
  {
    key: "campus-address",
    question: {
      my: "ကျောင်းလိပ်စာ",
      en: "What is the school address?",
      zh: "学校地址在哪里？",
    },
    answer: {
      my: "လိပ်စာ — ရှမ်းပြည်နယ်မြောက်ပိုင်း၊ အထူးဒေသ (၁)၊ လောက်ကိုင်မြို့၊ အမှတ် (၁) သင်ကြားရေး ဆေးရုံကြီး၏ မျက်နှာချင်းဆိုင် ဝန်းအတွင်းတည်ရှိပါသည်။ ကျန်းမာရေး ရုံးဌာန၊ ပြည်သူ့ကျန်းမာရုံးဌာနတို့နှင့် ကပ်လျက် ဖြစ်ပါသည်။",
      en: "Address: Northern Shan State, Special Region (1), Laukkai, within the compound opposite No. 1 Teaching Hospital, adjacent to the Health Office and Public Health Office.",
      zh: "地址：缅甸掸邦北部、第一特区、老街市，位于第一教学医院正对面的院区内，毗邻卫生办公室和公共卫生办公室。",
    },
    keywords: {
      my: ["လိပ်စာ", "လောက်ကိုင်", "သင်ကြားရေးဆေးရုံ", "ဘယ်မှာ"],
      en: ["address", "laukkai", "teaching hospital", "location"],
      zh: ["地址", "老街", "教学医院", "位置"],
    },
  },
];

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[.,!?;:()\[\]{}'\"“”‘’၊။—–_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function scoreEntry(entry: FaqEntry, input: string, language: Language) {
  const normalized = normalize(input);
  const question = normalize(entry.question[language]);

  if (normalized === question) return 100;
  if (normalized.includes(question) || question.includes(normalized)) return 30;

  let score = 0;
  for (const keyword of entry.keywords[language]) {
    const k = normalize(keyword);
    if (k && normalized.includes(k)) score += k.length >= 5 ? 4 : 2;
  }
  return score;
}

export function findFaq(input: string, language: Language): FaqEntry | null {
  let best: { entry: FaqEntry; score: number } | null = null;

  for (const entry of FAQS) {
    const score = scoreEntry(entry, input, language);
    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= 4 ? best.entry : null;
}
