"""'Ask your portfolio' assistant (SPEC.md section 11).

Tracing is forced off before any LangChain module is imported: with it on, LangChain would send
prompts and answers (chat text, tickers, amounts) to LangSmith, which the spec forbids.
"""
import os

for _var in ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING"):
    os.environ[_var] = "false"
