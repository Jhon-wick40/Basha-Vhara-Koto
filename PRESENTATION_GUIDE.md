# Basha Vhara Koto — Project Presentation Guide & Defense Script

**Course:** Software Project Design and Development Lab (`CSE - 416`)  
**Semester:** Autumn 2026  
**Presenter:** Syed Shihab Uddin (Student ID: `0432320005101062`)  
**Department:** Department of Computer Science & Engineering  
**File Generated:** [Basha_Vhara_Koto_Presentation_Updated.pptx](file:///d:/python/Basha__Vhara_Koto/Basha%20Vhara%20Koto/Basha_Vhara_Koto_Presentation_Updated.pptx)

---

## 1. Presentation Time Management (Target: 10–12 Minutes)

| Slide | Topic | Suggested Time | Focus |
|:---|:---|:---|:---|
| **Slide 1–2** | Title & Agenda | 0:45 min | Introduce yourself, project name, course code, and presentation roadmap. |
| **Slide 3–4** | Introduction & Problem Statement | 1:30 min | Real-world rental pain in BD (broker exploitation, fake identities, unrecorded cash deals). |
| **Slide 5–6** | Objectives & Related Works | 1:30 min | Project objectives and critical gaps in Bikroy / Bdproperty. |
| **Slide 7–8** | Methodology & System Architecture | 2:15 min | The 6-step lifecycle + React 18, React Native, Supabase RLS, Kong Gateway. |
| **Slide 9–11** | Tools, Socio-Economic Impact & Results | 2:00 min | Tech stack, paperless digital agreements, sub-45ms latency benchmarks. |
| **Slide 12** | Contribution Matrix | 0:30 min | Highlight your role as Lead Full-Stack Architect & Engineer. |
| **Slide 13–14** | Conclusion & Future Roadmap | 1:00 min | Summary of engineering achievements + Porichoy NID API & Escrow next steps. |
| **Slide 15** | Live Demonstration | 2:00 min | Role switch, GPS Near Me, deal proposal, simulated checkout, branded receipt. |
| **Slide 16–17** | References & Q&A | Defense | Academic citations & defense question handling. |

---

## 2. Slide-by-Slide Speaker Defense Notes

### Slide 1: Title Slide
> *"Honorable faculty members and examiners, welcome to my project presentation on **Basha Vhara Koto**. I am Syed Shihab Uddin (ID: 0432320005101062), presenting this work for CSE-416: Software Project Design and Development Lab, Autumn 2026. This project is a trust-first two-sided house rental platform engineered specifically for Bangladesh's residential ecosystem, featuring real-time geo-spatial matching, verified tenancy workflows, and tamper-resistant digital records."*

### Slide 2: Contents
> *"Today, I will take you through the complete engineering lifecycle: starting from real-world problem analysis, literature gaps, system methodology, and architectural design, followed by our core algorithmic implementations, performance benchmarks, and a live demonstration."*

### Slide 3: Introduction
> *"In metropolitan areas like Dhaka and Chattogram, over 65% of citizens live in rented accommodation. However, house hunting in Bangladesh suffers from an extreme trust deficit. Fake listings, unverified landlord ownership, predatory middlemen, and absence of standardized tenancy records create friction for both house seekers and genuine property owners. **Basha Vhara Koto** solves this through verified identities, structured administrative addressing, and transparent digital deal flows."*

### Slide 4: Problem Statement
> *"Our project directly tackles four fundamental systemic bottlenecks:  
> 1. **Predatory Dalals (Brokers)** charging 50% to 100% arbitrary commission fees with deceptive property descriptions.  
> 2. **Non-Standard Addressing:** Lack of street grid systems making map searches fail without holding numbers and ward zones.  
> 3. **Absence of Verifiable Rental History:** Good tenants have no proof of past reliability, while bad actors repeat fraud unchecked.  
> 4. **Informal Agreements & Zero Documentation:** Unrecorded cash payments leave both parties vulnerable without legally valid, itemized rental receipts or transaction proof."*

### Slide 5: Project Objectives
> *"Our objectives were concrete and engineering-focused:  
> • Eliminate intermediaries through direct peer-to-peer verification and communication.  
> • Implement a cascading administrative geographic filter (8 Divisions, 64 Districts, 570+ Thanas) alongside real-time GPS Haversine proximity search ('Near Me').  
> • Formalize the complete tenancy lifecycle with digital proposals, one-click landlord acceptance, simulated payments, and branded printable receipts.  
> • Create an immutable rental history ledger backed by Row Level Security (RLS) in PostgreSQL."*

### Slide 6: Related Works & Gap Analysis
> *"When comparing with existing portals like Bikroy or Bdproperty, they function merely as unverified classified boards with static text. Global apps like Airbnb or Zillow fail in Bangladesh because they cannot handle local City Corporation holding structures, localized administrative divisions, or bachelor/family restrictions. Basha Vhara Koto bridges these exact verification, documentation, and spatial precision gaps."*

### Slide 7: Methodology & Workflow
> *"The system guides users through a structured 6-stage lifecycle:  
> 1. Authentication & NID-backed KYC verification.  
> 2. Structured property listing using official administrative keys (Holding Number, Ward, Zone).  
> 3. Smart discovery via cascading dropdowns or GPS 'Near Me'.  
> 4. Real-time in-app negotiation per property.  
> 5. Digital deal proposal, landlord acceptance, and simulated checkout.  
> 6. Automated generation of a branded PDF receipt and verified rental ledger record."*

### Slide 8: System Architecture & Database Design
> *"We implemented a decoupled multi-tier cloud architecture:  
> • **Frontend:** React 18 single-page application built with Vite, TypeScript, and Tailwind CSS.  
> • **Mobile Client:** Expo React Native cross-platform application.  
> • **API Gateway:** Kong API Gateway managing route dispatch and rate limiting.  
> • **Database & Security:** Supabase-managed PostgreSQL 15 with strict Row Level Security (RLS), preventing unauthorized access even at the raw query level."*

### Slide 9: Use of Tools & Technologies
> *"Every tool was chosen for production reliability:  
> • TypeScript for type safety across shared modules.  
> • PostgreSQL with `SECURITY DEFINER` RPC functions to avoid recursive RLS checks.  
> • Docker & Docker Compose for isolated microservices and Kong gateway.  
> • Vitest for automated unit and security policy testing."*

### Slide 10: Outcome & Socio-Economic Impact
> *"The project delivers tangible socio-economic benefits:  
> • **Market Transparency:** Transforms informal cash handovers into verifiable digital tenancy records with branded receipts.  
> • **Cost Reduction:** Saves tenants and landlords 15,000–50,000 BDT in broker fees per relocation.  
> • **Safety for Vulnerable Groups:** NID verification significantly reduces risks for female students and families.  
> • **Environmental Sustainability:** Replaces paper notices and manual cash memos with a 100% paperless digital workflow."*

### Slide 11: Result Analysis & Performance Metrics
> *"Our empirical benchmarks demonstrated:  
> • Sub-15ms execution for Haversine spatial calculations around Dhaka coordinates.  
> • Database query latency under 45ms across 10,000+ relational records.  
> • 100% test pass rate on RLS isolation—zero privilege escalation detected.  
> • Flawless end-to-end deal flow state consistency across proposals, agreements, payments, and receipts."*

### Slide 12: Contribution Matrix
> *"As the solo developer and architect, I designed and implemented the full stack: from the PostgreSQL schema, RLS policies, and deal agreement pipelines, to the React 18 web UI, Expo mobile app, and real-time chat infrastructure."*

### Slide 13–14: Conclusion & Future Work
> *"In conclusion, Basha Vhara Koto proves that trust, transparency, and formal tenancy records can be automated in urban residential real estate. For future work, we plan direct integration with Bangladesh Government's Porichoy NID API, bKash/Nagad escrow payments, and machine learning fair-rent valuation models."*

### Slide 15: Demonstration Walkthrough
> *[Live Demo Steps]:  
> 1. Show Tenant login → Search with 'Near Me' GPS filter.  
> 2. Open listing → Initiate in-app chat → Propose rent terms.  
> 3. Switch to Landlord account → Accept proposal inline.  
> 4. Execute simulated payment → Display printable receipt with holding number and itemized breakdown.  
> 5. Open Tenant Lookup tool → Enter User ID to show verified rental history ledger.*

---

## 3. Potential Defense Questions & Model Answers

### Q1: Why did you implement custom Row Level Security (RLS) instead of application-level checks?
> **Answer:** *"Application-level checks are prone to bypass if an API endpoint forgets authorization logic. By enforcing Row Level Security directly inside PostgreSQL, every database query is mathematically scoped to the authenticated user's JWT `auth.uid()`, guaranteeing multi-tenant data isolation even if a client-side vulnerability occurs."*

### Q2: How does the Haversine formula handle 'Near Me' search compared to PostGIS?
> **Answer:** *"For our production MVP, implementing the mathematical Haversine formula in TypeScript and SQL provided zero-dependency spatial distance sorting with sub-15ms latency without requiring heavy PostGIS spatial extensions on the database cluster. For millions of listings in future versions, PostGIS spatial indexing with R-Tree indexes can be activated seamlessly."*

### Q3: How do the digital agreements and receipts work without physical paper?
> **Answer:** *"The tenant submits an agreement proposal with terms, dates, and amounts. The landlord can accept or reject it directly in the app. Once accepted and paid, the system automatically generates an immutable payment record and a branded printable digital receipt featuring a unique receipt ID, breakdown of rent, City Corporation holding details, and Google Maps location coordinates."*

### Q4: How is tenant privacy protected if landlords can look up rental history?
> **Answer:** *"The lookup requires an explicit custom Tenant User ID provided by the tenant during application. Furthermore, the lookup RPC `get_tenant_rental_history` only reveals verified completed payment timestamps and rental holding identifiers, without exposing private contact info, NID documents, or personal chat transcripts."*
