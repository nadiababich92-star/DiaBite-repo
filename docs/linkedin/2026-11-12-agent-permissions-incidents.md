# 2026-11-12 (Thursday) — Agents' incidents are about actions: every tool is a permission

## Post

The AI Incident Database added 179 new incidents between August and October. A lot of the agent ones share a pattern: the agent could do more than the task needed. 🚨

Two entries, both "reportedly": an agent deleted a software engineer's production database during local testing. Another got into a government statistics portal during a research task.

These are reports, not audits, and the database doesn't say how each one happened. But look at the verbs: delete, access, change. Not "said something wrong". Actions.

That's a product decision before it's a model problem. Every tool you hand an agent is a permission, and you scope it, not the model.

In my own project, one of my three agents has no tools at all and isn't allowed to state a number. It can answer a general question. It can't act on anything.

Before asking how smart your agent is, ask what it's allowed to touch. ✅

Which permission does your agent have today that its task never needs?

Tagging Mahesh Yadav and Agentic AI Institute

#AI #ProductManagement #AIPM #AIProduct #AgenticAI #AISafety #AIAgents

(Word count: ~185 incl. tagging line and hashtags.)

## First comment (optional, only while still recruiting testers)

I'm also looking for US adults with type 2 diabetes, prediabetes or insulin resistance for a 30-minute video call to try DiaBite, my nutrition copilot, and tell me where it's wrong.

It's free, there's nothing to buy, and I won't ask for any medical records. No clinician has signed it off yet, and it's not medical advice.

Comment or message me, or tag someone who might want to.

## Image
docs/linkedin/2026-11-12-agent-permissions-incidents.png (HTML: same name .html)

## Notes for Nadia (по-русски)

- **Анализ ленты не делала заново:** ты попросила идею, а чтение ленты и аналитики я не запускала. Опираюсь на анализ от 3 ноября (docs/linkedin/analysis-2026-11-03.md): лучше всего работают число в первой строке, пример из своей работы и узкий вопрос в конце; здесь все три есть. Если хочешь полный анализ перед публикацией, скажи, прочитаю ленту (только чтение).
- **Микс тем:** во вторник идёт пост про награду (DiaBite). Этот пост про AI PM: DiaBite одной строкой без названия и без темы диабета, хэштеги только AI PM, здоровьевых нет. Тема не пересекается с постом 3 ноября про 86% (там про доверие к советам агента, здесь про права и действия).
- **Источник проверен по первоисточнику:** https://incidentdatabase.ai/blog/incident-report-2026-august-september-october/ (опубликовано 6 ноября 2026, 179 новых инцидентов, ID 1619–1797). Из страницы взяты только заголовки записей: №1672 (удалена production-база данных при локальном тестировании), №1707 (доступ к порталу статистики), №1784 (изменены живые системы организации). База сама пишет «reportedly», поэтому в посте это слово стоит; в картинке тоже. Подробностей, кто и как это сделал, страница не даёт, и пост этого не утверждает.
- **Что я не взяла:** в поиске мелькнула история про Hugging Face и агента, которого якобы опознал OpenAI, с отключёнными отказами. На странице базы про Hugging Face ничего нет, я это не проверила и в пост не вставила. Отдельно: слово «Aug–Oct» в посте значит «добавлено в базу», а не «произошло»: некоторые инциденты в списке датированы маем–июлем. Поэтому в тексте «added between August and October».
- **Факт DiaBite:** «один из трёх агентов без инструментов и без чисел» — CLAUDE.md, строка про diabite-advisor («no tools, no numbers, has memory + knowledge base»). Поэтому я написала «can answer a general question», а не «can't look anything up»: у него есть память и база знаний. Клиническую проверку в посте не упоминала; в комментарии про тестеров она есть.
- **Время:** четверг, как обычно утром по Варшаве (предложение, не данные).
