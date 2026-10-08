# dsh-bid-ca-precheck — निविदा की प्रत्येक आवश्यकता के विरुद्ध बोली की अनुरूपता की पूर्व-जाँच

`dsh-bid-ca-precheck` एक 投标符合性响应台账 पढ़ता है — निविदा की आवश्यकताएँ और बोली लगाने वाले के उत्तर, रजिस्टर के अपने चीनी या अंग्रेज़ी कॉलम-नामों से लिए गए — और एक संस्करण-बद्ध नियम-पैक लागू करके उसी रजिस्टर की पूर्णता और आंतरिक सहमति जाँचता है: हर निविदा आवश्यकता के सामने उत्तर दर्ज है या नहीं, निर्णय (verdict) आपके द्वारा कॉन्फ़िगर की गई सूची से लिया गया है या नहीं, क्लॉज़ क्रमांक रजिस्टर में अनन्य हैं या नहीं, रजिस्टर अपना प्रोजेक्ट और बोली लगाने वाला बताता है या नहीं, आपके चिह्नित किए उच्च-जोखिम क्लॉज़ के साथ प्रमाण दर्ज है या नहीं, और आवश्यकता-कॉलम में टेम्पलेट प्लेसहोल्डर के बजाय वास्तविक आवश्यकताएँ हैं या नहीं।

## यह किन सवालों का जवाब देता है

| आपका सवाल | इसका जवाब |
|---|---|
| किसी निविदा आवश्यकता का `response` कॉलम खाली है — क्या यह दर्ज होता है? | हाँ। `BC-001` उस पंक्ति को दर्ज करता है, क्योंकि हर निविदा आवश्यकता के सामने उत्तर दर्ज होना चाहिए। यह केवल देखता है कि `response` कॉलम भरा है या नहीं — यह नहीं आँकता कि उत्तर उस आवश्यकता को पूरा करता है या नहीं, जो मूल्यांकन समिति का निर्णय है। |
| मैंने `verdict` कॉलम भर दिया, फिर भी रिपोर्ट कहती है कि नियम चल नहीं सका। क्यों? | `BC-002` हर मान की तुलना उस निर्णय-शब्दावली से करता है जो आप कॉन्फ़िगर करते हैं, और वह सूची खाली आती है; इसलिए जब तक आप `values` नहीं भरते, नियम अनुमान लगाने के बजाय स्वयं को `skipped` में दर्ज करता है। कॉन्फ़िगर होने पर यह केवल वह मान दर्ज करता है जो आपकी सूची में न हो; निर्णय सही है या नहीं, यह कभी नहीं आँकता। |
| रजिस्टर की दो पंक्तियों में एक ही क्लॉज़ क्रमांक है। | `BC-003` दोहराया गया `clause` मान दर्ज करता है: एक ही क्रमांक दो बार आने पर यह तय नहीं होता कि कौन-सी पंक्ति किस आवश्यकता का उत्तर है। तुलना में खाली जगह नहीं गिनी जाती, इसलिए `3.2` और ` 3.2 ` एक ही क्रमांक माने जाते हैं। यह केवल अनन्यता देखता है — दोनों में से कौन-सी पंक्ति सही है, यह नहीं तय करता; ऐसा मिलना आम तौर पर दोहरी प्रविष्टि या गलत कॉपी किए क्रमांक का संकेत है। |
| रजिस्टर में यह नहीं लिखा कि यह किस प्रोजेक्ट का है और बोली लगाने वाला कौन है। | `BC-004` छूटा हुआ हेडर-फ़ील्ड दर्ज करता है और `project` तथा `bidder` दोनों की अपेक्षा करता है। यह आवश्यकता पता-लगाने (traceability) से आती है — जो निर्णय किसी प्रोजेक्ट और बोली लगाने वाले से न जुड़े, उसकी बाद में समीक्षा नहीं हो सकती — किसी ऐसी धारा से नहीं जो रजिस्टर में हेडर अनिवार्य करती हो। |
| किन पंक्तियों में प्रमाण देना ज़रूरी है? | `BC-005`: हर उस पंक्ति में जिसके `requirement` पाठ में आपका कोई उच्च-जोखिम कीवर्ड समावेशन (containment) से मेल खाता हो। `highRiskKeywords` खाली आती है, इसलिए जब तक आप उसे नहीं भरते, नियम चुपचाप पास होने के बजाय स्वयं को `skipped` में दर्ज करता है। यह केवल देखता है कि `evidence` कॉलम भरा है या नहीं, यह नहीं कि प्रमाण वैध या पर्याप्त है। |
| कुछ पंक्तियों के आवश्यकता-कॉलम में अब भी 【……】 या `待填` लिखा है। | `BC-006` उन पंक्तियों को दर्ज करता है: `requirement` कॉलम में बचे `【`, `】`, `{{`, `}}`, `XXX`, `待填`, `TBD` जैसे शब्द आम तौर पर बताते हैं कि रजिस्टर टेम्पलेट से कॉपी किया गया और कभी भरा ही नहीं गया। शब्दों की यह सूची आप अपने टेम्पलेट के अनुसार बदल सकते हैं। नियम केवल प्लेसहोल्डर दर्ज करता है; आवश्यकता स्वयं वास्तविक है या नहीं, यह नहीं तय करता। |

## यह किन मानकों पर आधारित है

| दस्तावेज़ | संख्यांक | इन्हें उद्धृत करने वाले नियम |
|---|---|---|
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正（全国人大常委会《关于修改〈中华人民共和国招标投标法〉、〈中华人民共和国计量法〉的决定》），本法自2000年1月1日起施行 | BC-001, BC-003, BC-004, BC-006 |
| 《中华人民共和国招标投标法实施条例》 | 国务院令第613号（2011 年 12 月 20 日公布，2017 年 3 月 1 日修订，自 2012 年 2 月 1 日起施行） | BC-002 |
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正，自2000年1月1日起施行 | BC-005 |

**Boundary:** this plugin checks a **投标符合性响应台账** for what a register can be held to — that every
tender requirement has a recorded response, that verdicts come from your vocabulary and clause numbers are
unique, that a high-risk clause carries evidence, and that the requirement column still holds real
requirements rather than template placeholders. It does **not** decide whether a bid is valid, whether it
should be rejected, or whether a response is a material deviation. **Those calls belong to the evaluation
committee, and this plugin never makes them** — a test asserts that no rule here can be `error`.

> ### ⚠️ Read this before trusting a citation in the report
>
> **Every `excerpt` in this plugin's rule pack says, in so many words, that the clause text was not
> obtained.** The regime lives in 《招标投标法》, 《招标投标法实施条例》 and each project's 评标办法. The
> verification pass for this plugin could not retrieve verbatim clause text from them, so rather than
> paraphrase a quotation the pack states the gap in the `excerpt` field itself and puts the honest
> reasoning in `note`. Every rule is therefore `warn` or `info`, and a test asserts that no rule claims a
> quotation it does not have. **When the texts are in hand, two things must be done: replace each
> `excerpt` with the real clause, and raise `kind` to `direct`.**
>
> The worst failure mode of a register tool is a register copied from a template and mistaken for a
> checked one, so `BC-006` looks for exactly that: `【】`, `{{}}`, `XXX`, `待填`, `TBD` left in the
> requirement column.
>
> Two lists are yours, not a standard's: the verdict vocabulary (`BC-002`) and the high-risk keywords
> (`BC-005`). Both ship **empty**, and a rule whose list is unset reports itself in `skipped` rather than
> passing silently.

## Compatibility

| सतह | स्थिति |
|---|---|
| Harness | peer रेंज `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — `0.2.0-rc.2` और `0.2.1-alpha.1` दोनों को स्वीकार करने के लिए सत्यापित। **`engines.dsh` जानबूझकर घोषित नहीं**: इसका कोई पाठक नहीं और यह किसी होस्ट को अस्वीकार नहीं कर सकता |
| Node | `^22.19.0 || >=24.0.0` |
| प्लेटफ़ॉर्म | सभी (शुद्ध ESM; कोई नेटिव कोड नहीं, कोई नेटवर्क नहीं, कोई मॉडल कॉल नहीं) |
| टूल मोड | `native`, `ptc` और `both` में काम करता है; पूरे फ़ोल्डर के लिए `ptc` चुनें |

## What it does

नियम-सूची, फ़ील्ड और विस्तृत व्यवहार [README.md](README.md#what-it-does) (अंग्रेज़ी मुख्य संस्करण) में हैं। यह प्लगइन केवल उद्धृत धाराओं के सामने शाब्दिक अंतर सूचीबद्ध करता है और हर न चल पाई जाँच को `skipped` में बताता है।

## Install

```sh
dsh plugin --profile <name> add dsh-bid-ca-precheck
dsh --profile <name> --dump-config | grep 'dsh-bid-ca-precheck'
```

## Configuration

सभी समायोज्य पैरामीटर `src/config.ts` की Schemastery स्कीमा में हैं, इसलिए कोड बदले बिना `cordis.yml` से बदले जा सकते हैं; प्रति-नियम सीमाएँ `rules/` के नियम-पैक में हैं।

| कुंजी | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `rulesFile` | string | `rules/bid-ca-precheck.yaml` | नियम-पैक का पथ, पैकेज रूट के सापेक्ष |
| `disabledRules` | string[] | `[]` | बंद करने वाले नियम id; प्रत्येक `skipped` में दिखता है |
| `onlyRules` | string[] | `[]` | केवल ये नियम चलाएँ; खाली होने पर सभी नियम चलते हैं |
| `skipNotes` | string | `""` | हर `skipped` कारण के आगे जोड़ी जाने वाली टिप्पणी |
| `timeoutMs` | number | `120000` | उपकरण का सहकारी समय-सीमा बजट |

## Material format

JSON या YAML स्वीकार्य है। पूरा फ़ील्ड उदाहरण [README.md](README.md#material-format) (अंग्रेज़ी मुख्य संस्करण) में है। पढ़ने की परत में फ़ील्ड वैकल्पिक हैं और जाँच इंजन उन्हें सत्यापित करता है, इसलिए आंशिक निर्यात पर क्रैश के बजाय "अनुपस्थित" श्रेणी के निष्कर्ष मिलते हैं।

## Rule sources

नियम-डेटा कोड से अलग है: प्रत्येक नियम में दस्तावेज़, संख्या, स्रोत की अपनी क्रमांकन-प्रणाली के अनुसार धारा, शब्दशः उद्धरण और स्रोत URL होता है। लोडर लागू करता है कि उद्धरण कम से कम आठ अक्षरों का वास्तविक उद्धरण हो, और जिस जाँच का आधार केवल सामान्य सिद्धांत (`kind: derived-from-principle`, अधिकतम `warn`) या स्थानीय नीति (`kind: institutional-configuration`, अधिकतम `info`) हो, उसे कभी `error` घोषित न किया जाए।

सत्यापित सीमाएँ और जान-बूझकर **न** कहे गए निष्कर्ष [README.md](README.md#rule-sources) (अंग्रेज़ी मुख्य संस्करण) और `rules/evidence/` में हैं।

## Troubleshooting

- **प्लगइन इंस्टॉल हो गया पर टूल दिखता नहीं**: जाँचें कि `main` `lib/index.mjs` पर जाता है और `pnpm run build` ने उसे बनाया है।
- **`dsh plugin add` असंगत बताकर मना करता है**: peer range `0.1.x` और `0.2.x` दोनों को कवर करती है; बाहर होने पर स्पष्ट छूट दें: `dsh plugin --profile <name> allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`।
- **कोई नियम नहीं चला**: `skipped` सरणी देखें।
- **`check` में `manifest-peers` विफल दिखता है**: यह `dsh-plugin-dev` की ज्ञात अपस्ट्रीम समस्या है; रनटाइम इंस्टॉल के समय अनुकूलता लागू करता है।
- **समय खिसका हुआ लगता है**: सारी गणना दिए गए स्ट्रिंग पर वॉल-क्लॉक है।

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-bid-ca-precheck
```

अंतिम कमांड `../_shared` का साझा किट `src/shared/` में कॉपी करता है; हर साझा बदलाव के बाद इसे दोबारा चलाएँ।

## License

[Apache License 2.0](LICENSE) © 2026 dsh-bid-ca-precheck contributors.
