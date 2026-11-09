# 2026-11-03 — When an agent has a lean, experts follow it (86%)

## Post

Expert analysts went with an AI agent's opinion 86% of the time, and that opinion was set by a coin flip. 🎲

Anthropic published this on Oct 27. 50 experienced analysts used Claude Code to advise on a fictional farming program. For each analytical choice, the agent's lean was secretly random, and it was told to argue honestly.

Result: analysts matched its lean in 86% of four choices. Chance would be about 50%. Only 15% credited the agent, though 77% repeated its arguments.

The authors say they deliberately strengthened the lean, and it's one task and one model. So the exact number won't transfer. The mechanism might.

The agent didn't lie. Both options were defensible, so nobody noticed a decision being made.

For a PM, that's a design problem. Every judgment call your agent makes silently is a decision your user never made.

In my own project the agent can't choose a number at all: an engine computes it, and the user can open the receipt behind it.

Don't hide the choice. Show it.

Which default does your agent pick for users today without ever showing it as a decision?

Tagging Mahesh Yadav and Agentic AI Institute

#AI #ProductManagement #AIPM #AIProduct #AgenticAI #AIAgents #HumanInTheLoop

(Word count: ~205 incl. tagging line and hashtags.)

## First comment

I'm also looking for 5 US adults with type 2 diabetes, prediabetes or insulin resistance for a 30-minute video call to try DiaBite, my nutrition copilot, and tell me where it's wrong.

It's free, there's nothing to buy, and I won't ask for any medical records. It's a prototype, not medical advice.

Comment or message me, or tag someone who might want to.

## Image
docs/linkedin/2026-11-03-agent-deference-86-percent.png (HTML: same name .html)

## Notes for Nadia (по-русски)

**Анализ:** docs/linkedin/analysis-2026-11-03.md. Подписчики 1 630 (+49 с 20.10). Лента прочитана (только чтение, вкладка закрыта). Органика 200–435 показов; лучшие — итоги курса (433) и фреймворк (431), слабее всего общие рассуждения (201–256). Пост-буст для диетологов (6 дней) — 2 095 показов, 5 реакций, 1 комментарий; сравнивать с органикой нельзя. **Черновик от 27.10 («agent autonomy / human evals») в ленте не опубликован** — этот пост на соседнюю тему (агенты и человеческое суждение), поэтому не публикуй их подряд; если хочешь опубликовать оба, разнеси на 1–2 недели.

**Правило микса:** последние 3 опубликованных поста (буст-пост для диетологов, «oversight before the model», итоги курса) — все про DiaBite/здоровье, поэтому этот пост про AI PM, DiaBite одной строкой без названия приложения и без темы диабета; хэштеги только AI-PM. **Дрейф позиционирования: viewer mix not checked — посмотри, пожалуйста, аналитику 2–3 последних постов (особенно буст-поста) на уклон в healthcare/диетологов.**

**Почему эта тема:** кандидаты:
1. Исследование Anthropic «How AI agents shape experts' judgment calls» (27.10) — **выбрано**: свежее, обсуждаемое, про доверие к агентам и оценку, проверено по первоисточнику https://www.anthropic.com/research/agents-judgment-calls (50 аналитиков из 61 рекрутированных; 86% vs ~50% по шансу; 15% указали агента; 77% повторяли его аргументы; оговорки авторов про усиленный «наклон», одну задачу и одну модель я включила).
2. Банки блокируют сторонних AI-агентов в счетах клиентов (Axios, 22.10; пересказ https://aisdg.substack.com/p/ai-news-for-october-30-2026, подтверждение Reuters по другим источникам) — не взяла: первоисточник Axios отдал 403, я не смогла его проверить, и утверждение о «несанкционированных агентах» оспаривается (Morgan Stanley заявил, что не видел «rogue-агентов»); к тому же 12 дней.
3. Salesforce Agent Evals / Kill Switch (https://www.salesforce.com/news/stories/agent-fabric-catch-failures-control-ai-costs/) — не взяла: автоматические триггеры отключения, по трейд-прессе, заработают только в январе 2027 (вендорские заявления), и тема evals уже была в предыдущих постах.
Общий поиск «на этой неделе» отдавал в основном устаревшие страницы; это отмечаю как ограничение.

**Слов:** ~205.
**Плейсхолдеры:** нет.
**Факты DiaBite:** «агент не выбирает число, движок считает, пользователь открывает чек» — docs/PRD-product.md (раздел «Anatomy of an answer»: «Show calculation» открывает receipt; все числа считает движок) и CLAUDE.md («The one promise»). Клиническую проверку не упоминала.
**Допущения:** формулировка «experienced analysts» — по данным Anthropic (65% с магистерской/PhD степенью или 6+ годами опыта); «told to argue honestly» — из описания исследования. Статистику про 60%/6% переключения и 6 из 11 ошибок не использовала (малые выборки, авторы сами оговаривают). Это исследование про влияние, не про ошибочность выбора, — в посте так и сказано («the agent didn't lie… both defensible»). Картинка: источник и оговорки указаны в футере.
