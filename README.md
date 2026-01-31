# KHU Notebook Research Assistant (MCP)

**Version:** 0.0.1 (2026-01-31)  
**Author:** Taekyung Kim, PhD. Professor, Kyung Hee University

## Overview

The **KHU Notebook Research Assistant** is a specialized Model Context Protocol (MCP) server designed to interface with Google NotebookLM. It empowers AI agents to conduct autonomous academic research, manage knowledge bases, and generate study artifacts efficiently.

This project is tailored for research and educational purposes, enabling seamless integration between LLMs and NotebookLM's grounded reasoning capabilities.

## Key Capabilities

*   **Autonomous Deep Research**: Performs multi-step web research and automatically summarizes and imports findings into your notebook.
*   **Study Artifact Generation**: Instantly creates derived materials from your sources:
    *   Audio Overviews (Podcasts)
    *   Research Reports
    *   Infographics
    *   Presentation Slides
    *   Data Tables (Google Sheets)
    *   Flashcards & Quizzes
    *   Mind Maps
*   **Knowledge Management**: Systematic control over notebook creation, source addition (URLs, Text, PDFs), and organization.

## Installation

```bash
npm install
npm run build
```

## Configuration

This server requires a valid Google session to interact with NotebookLM. 
Session credentials (cookies) should be stored in `~/.notebooklm-mcp/auth.json` or passed via environment variables.

## Tools Available

| Tool | Description |
|------|-------------|
| `research_notebook_list` | Lists all active research notebooks. |
| `research_deep_search` | Conducts deep web research on a specific topic. |
| `generate_study_material` | Generates artifacts like Slides, Reports, or Audio. |
| `add_source_content` | Injects new research materials (URLs, Text) into the notebook. |

## License

Private / Academic Use Only.
Copyright (c) 2026 Taekyung Kim, PhD. All Rights Reserved.
