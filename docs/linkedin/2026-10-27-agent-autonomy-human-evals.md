# 2026-10-27 — Agent autonomy is capped by how it's evaluated

## Post

74% of teams running AI agents in production still evaluate them mainly with humans. I think that's the real ceiling on agent autonomy, not the model. 📉

It's from "Measuring Agents in Production", a study of 20 case studies plus a survey of 86 practitioners. Two more numbers from it: 68% of production agents run at most 10 steps before a human steps in, and reliability is the #1 challenge.

Put those together. If a person has to read the answers to know they're right, your agent's autonomy is exactly as large as that person's reading speed.

So autonomy isn't a setting you turn up. It's a verification problem you solve first.

In my own project I run about 200 automated checks against the live agent after every prompt change. The trick that made them last: checks read the structured tool results, never the agent's wording. Every time I matched on phrasing, the check broke the day the agent started sounding more natural.

Taking the human out of the loop isn't removing oversight. It's moving it into things a machine can check. ✅

Before asking "which model?", ask "what can I verify without reading it?"

Which check on your agent's output could you automate this week: a number, a refusal, or a tool call?

Tagging Mahesh Yadav and Agentic AI Institute

#AI #ProductManagement #AIPM #AIProduct #AgenticAI #LLMEvals #AIAgents

(Word count: ~215 incl. tagging line and hashtags.)

## First comment

I'm also looking for 5 US adults with type 2 diabetes, prediabetes or insulin resistance for a 30-minute video call to try DiaBite, my nutrition copilot, and tell me where it's wrong.

It's free, there's nothing to buy, and I won't ask for any medical records. It's a prototype, not medical advice.

Comment or message me, or tag someone who might want to.

## Image
docs/linkedin/2026-10-27-agent-autonomy-human-evals.png (HTML: same name .html)

## Notes for Nadia (по-русски)

**Анализ:** docs/linkedin/analysis-2026-10-27.md. Подписчики 1 618 (+37 с 20.10). Последние 3 опубликованных поста — все про DiaBite, поэтому правило микса → этот пост про AI PM, DiaBite только одной строкой («my own project»), название приложения и диабет не упомянуты, хэштеги только AI-PM. Лучшие недавние по показам: фреймворк (429) и итоги курса (420); слабее всех последний (225), но он самый свежий. Viewer mix not checked — **пожалуйста, посмотри аналитику последних 2–3 постов на дрейф в сторону healthcare/диетологов**, особенно после буста с 28.10. Пост про диетологов (22.10) в ленте не виден — буст оцени отдельно.

**Почему эта тема:** кандидаты:
1. Исследование «Measuring Agents in Production» (arXiv, 25 авторов; 86 практиков, 20 кейсов) — **выбрано**: проверено по первоисточнику https://arxiv.org/abs/2512.04123 (74% — в основном человеческая оценка; 68% агентов ≤10 шагов до вмешательства человека; надёжность — главный вызов) и есть твой честный пример.
2. Отчёт Axial Search по 12 397 вакансиям AI product (https://axialsearch.com/insights/ai-product-management-jobs/) — данные до июля, не «на этой неделе», не проверяла по первоисточнику.
3. OpenAI DevDay (29 сентября) — устарело, названия продуктов в источниках расходятся.
Новостей именно за 20–26 октября поиск не нашёл — это честно указано; пост опирается на исследование, а не на «срочную новость». Вторичный источник называл 306 респондентов — я использовала 86 из первоисточника.

**Слов:** ~215. **Плейсхолдеров нет.**
**Факты DiaBite:** «около 200 автоматических проверок на живом агенте после каждого изменения промпта» — docs/STATUS.md (204 из 204 на 21 окт.) и CLAUDE.md, правила 7–8; «проверки читают результаты инструментов, не формулировки» — CLAUDE.md, правило 7. Клиническую проверку не упоминала.
**Допущения:** «after every prompt change» — по правилу 8; если хочешь точнее, замени «about 200» на актуальное число последнего прогона (26 окт.). Картинка: источник указан в футере.
