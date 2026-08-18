UPDATE manual_sections
SET body = body || '\n\nDirect lookup အတွက် /limits <telegram_user_id> ကို သုံးနိုင်ပါတယ်။ Pager ထဲမပေါ်သေးသော normal test account ကိုပါ တိုက်ရိုက်ဖွင့်ပြီး Exempt 1h သို့မဟုတ် အခြား override ပေးနိုင်ပါတယ်။ Cooldown/restriction/ban အတွင်း user က spam messages ဆက်ပို့နေပါက system warning ကို message တိုင်းမပြန်ပို့ဘဲ 5 minutes တစ်ကြိမ်ထက် မပိုအောင် throttle လုပ်ထားပါတယ်။ Blocked text ကိုတော့ ဆက်လက် FAQ/AI/escalation pipeline ထဲ မပို့ပါ။',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE section_key='spam-protection' AND manual_key IN ('owner','admin');
