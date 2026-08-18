UPDATE manual_sections
SET body = body || '\n\nEscalation case တစ်ခုက typo, accidental message, test, သို့မဟုတ် knowledge backlog အတွက် မသင့်တော်သော record ဖြစ်ပါက case detail ထဲက 🗑 Delete Case ကိုသုံးနိုင်ပါတယ်။ Bot က permanent deletion confirmation screen ကိုအရင်ပြပြီး 🗑 Yes, Delete Permanently ကိုထပ်နှိပ်မှသာ case နှင့် အဲဒီ case ရဲ့ escalation-message history ကိုဖျက်ပါတယ်။ Cancel လုပ်လျှင် case detail ဆီပြန်သွားပါတယ်။ User record, original source question log, သို့မဟုတ် case ကနေ အရင်ဖန်တီးပြီးသား FAQ ကို မဖျက်ပါ။',
    version = version + 1,
    updated_by = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE section_key='escalation-knowledge-pipeline' AND manual_key IN ('owner','admin');
