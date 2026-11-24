# Prepnova Education

**Adaptive Digital SAT preparation platform with a zero-trust, server-side security model, built with Next.js 16 and Supabase.**

🌐 **Live Platform:** [prepnovaed.com](https://prepnovaed.com) · 📐 **[Full System Architecture](docs/ARCHITECTURE.md)**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwind-css&logoColor=white)

---

## Core Features

* **Multi-Stage Adaptive Testing Engine:** Mirrors the official Digital SAT with dynamic Y-threshold routing (`Base` → `Easier` / `Harder` modules) and difficulty-weighted 200–800 section scoring curves.
* **Built-In Desmos Graphing Calculator & Exam Tools:** Integrated floating Desmos API calculator, CSS Custom Highlight API text annotations, option eliminators, and authoritative section timers.
* **Randomized Practice & O(1) Difficulty Calibration:** Topic/difficulty-filtered practice sessions backed by an atomic Elo-style difficulty rating engine on a 400–1600 scale.
* **Live Classes & Video Archive:** Tier-gated live lecture streams and on-demand session recordings with playback telemetry.
* **Full-Stack Admin & Owner Control Suite:** 13+ administrative tools including bulk JSON/SVG ingestion with SHA-256 duplicate detection, drag-and-drop module/test builders, bug triage, and real-time analytics.

---

## System Architecture

```mermaid
flowchart LR
    Client["Client Browser\n(Next.js App Router)"] -->|"Server Actions & SSR"| Server["Next.js 16 Server Layer\n(Middleware + Tiered RBAC)"]
    Server -->|"Anon Key (RLS Enforced)"| UserDB["User & Telemetry DB\n(Auth, Profiles, Submissions)"]
    Server -->|"Service Role Key (Server-Only)"| ContentDB["Content Vault DB\n(Questions, Modules, Tests)"]
