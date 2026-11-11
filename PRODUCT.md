# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: Vite + vanilla TypeScript, Three.js (instanced brick meshes) for the persistent 3D model, GSAP ScrollTrigger for scroll choreography. Static output, free hosting (Vercel or GitHub Pages). Chosen for small bundle, full control over the one 3D scene, and no framework overhead on a single-page site.

## Users

Primary: technical recruiters and engineering managers evaluating Raj Vora (UC Berkeley, CS + Data Science) for software engineering / ML internships and roles. They skim on a laptop between other candidates, often arriving from a resume link, and need to answer "what has this person built, and is it real?" within about 30 seconds.

## Product Purpose

A personal portfolio that makes Raj memorable among similar candidates while keeping every fact as easy to scan as the resume. Success means a recruiter remembers the site, can quote one concrete result, and clicks through to email, GitHub, or LinkedIn.

## Positioning

Raj's work is literally about bricks and building: BrickMatch is a computer-vision system for LEGO piles, and he led LEGO-robotics camps at Code Ninjas. The site's central device is that the visitor watches the same set of bricks rebuilt again and again as they scroll, so "every experience builds on the last" is shown, not stated. No other candidate can truthfully claim this.

## Operating Context

- Arrives via resume link, LinkedIn, or a direct share; desktop first, but phones must work.
- Visitors may have reduced motion enabled, or a low-power device; content must never depend on the animation finishing.

## Capabilities and Constraints

- Sections: Hero ("I'm Raj. I build things."), Experience ("The Building Blocks"), Projects ("Things I've Built"), About ("Beyond the Bricks"), Contact ("Let's build something together").
- All resume content must be readable as real text (selectable, indexable), never only inside the 3D scene.
- Trademark: do not use the LEGO name or logo as branding, and do not replicate the official minifigure. Use generic interlocking bricks and a brick-built figure of Raj. Saying "LEGO" when describing BrickMatch's dataset is factual and allowed.
- About interests (confirmed, Raj's own words):
  - **Hiking:** "I love exploring new trails, especially ones with challenging climbs and rewarding views. Some of my favorite hikes have been Yosemite's Mist Trail, Mount Tammany in New Jersey, and trails around Mount Rainier. I'm always looking for my next adventure."
  - **Pickleball:** "Pickleball is one of my favorite ways to stay active, compete, and spend time with friends. I love how a casual game can turn into a surprisingly intense match."
  - **LEGO building:** "I've loved building with LEGO for years, from following detailed sets to experimenting with my own creations. That interest even inspired BrickMatch, a computer vision project I'm developing to identify loose LEGO pieces and recommend things you can build with them."
- Photos planned but not yet supplied: a trail photo (Yosemite / Rainier), a pickleball action shot, a favorite build plus a BrickMatch screenshot. Design slots for them; never substitute stock or generated photos of Raj.
- Links: GitHub https://github.com/RajVora1, BrickMatch repo https://github.com/RajVora1/brickmatch. ARGOS has no public link.

## Evidence on Hand

From the resume (Raj_Vora_Microsoft.pdf, Nov 2026):

- **Packaging Matters**, Software Engineer (Contract), Oct 2026–present: Python/Pandas/SQL pricing engine; quote generation time cut 65%; 95% pricing accuracy, 80% fewer errors.
- **ASSIP at George Mason University**, Student Research Intern, Jun–Oct 2025: Intelligent Tutoring System (shown on the site as the **ARGOS** project); 65% average math-performance gain across 50+ students; 30-point LLM-tutoring rubric with 0.837 Pearson correlation against 4 human evaluators across 8 scenarios; presented at the 2025 MIT Undergraduate Research Technology Conference with 3 peers.
- **Code Ninjas**, Teaching Assistant, Mar 2024–Aug 2026: 200+ students ages 6–14, 100+ lessons; led 10+ camps incl. LEGO robotics, Roblox, 3D modeling, AI.
- **Encode Justice**, AI Council Member, Aug 2024–Sep 2025: 1 of 20 council members; AI-literacy talks at 10+ community centers; outreach to 20+ legislators on deepfake legislation.
- **Digital Inclusion Initiative**, CEO & Executive Director, Aug 2024–Sep 2025: raised $5,000; 10+ computers built; 250+ devices donated; 20+ donation drives; 5+ chapters.
- **BrickMatch** (Python, PyTorch, YOLO, ResNet-18): 90% detection recall, 85% classification accuracy on LEGO pile images, 8 colors; hand-labeled dataset split by physical pile to prevent leakage; ranks 10+ builds by piece coverage and recommends alternatives.
- **Skills:** Python, Java, SQL, TypeScript, JavaScript, Gleam, HTML/CSS; PyTorch, React, scikit-learn, FastAPI, Pandas, Docker, Firebase.
- **Contact:** rajvora@berkeley.edu, linkedin.com/in/raj-vora9, github.com/RajVora1.

Absent and must not be fabricated: testimonials, photos, project screenshots, ARGOS architecture details beyond the resume, metrics beyond those listed.

## Product Principles

1. **Facts first, theater second.** Every number a recruiter needs is readable without waiting for an animation.
2. **One model, one meaning.** A single persistent set of bricks carries the story; no disconnected decorative effects.
3. **Show the build.** Results come with how they were made (pipeline, rubric, data split), the way an engineer would explain them.
4. **Honest scale.** Claim exactly what the resume supports.

## Accessibility & Inclusion

Respect `prefers-reduced-motion` (bricks appear in their final shapes, no scroll-scrubbed motion); WCAG AA contrast for text; full keyboard navigation; a meaningful no-WebGL fallback.
