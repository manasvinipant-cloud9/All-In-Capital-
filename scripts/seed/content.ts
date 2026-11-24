// FICTIONAL. Portfolio, memos, meetings.
export const PORTFOLIO = [
 ["MeetRecord","Records and summarises sales calls for teams","B2B SaaS","active",["sales","ai"],"meetrecord.example"],
 ["ShopStack","Checkout and inventory tools for small retailers","Commerce infrastructure","active",["retail"],"shopstack.example"],
 ["PaySutra","UPI collections for micro-merchants","Fintech","active",["payments"],"paysutra.example"],
 ["KisanKart","Farm-input marketplace","Commerce infrastructure","active",["agri"],"kisankart.example"],
 ["Anaaj Foods","Packaged staples brand","Consumer brand","active",["food"],"anaajfoods.example"],
 ["GlowLab","Dermatologist-led skincare","Consumer brand","active",["beauty"],"glowlab.example"],
 ["SkyScan","Satellite crop analytics","Deeptech","active",["agri","space"],"skyscan.example"],
 ["CircuitNest","Low-cost IoT sensors","Deeptech","active",["hardware"],"circuitnest.example"],
 ["FinNudge","Savings nudges for gig workers","Fintech","active",["savings"],"finnudge.example"],
 ["BharatBill","Utility bill payments for small towns","Fintech","exited",["payments"],"bharatbill.example"],
 ["TutorTrail","Vernacular test prep app","Consumer tech","active",["edtech"],"tutortrail.example"],
 ["Chaiwala Co","Premium chai subscriptions","Consumer brand","active",["beverage"],"chaiwala.example"],
 ["LoopLedger","Bookkeeping for CA firms","B2B SaaS","active",["accounting"],"loopledger.example"],
 ["MotoMend","On-demand two-wheeler repair","Consumer tech","shut_down",["mobility"],"motomend.example"],
 ["VoltRoute","Battery swapping for delivery riders","Deeptech","active",["ev"],"voltroute.example"],
 ["StitchKart","B2B garment sourcing","Commerce infrastructure","active",["apparel"],"stitchkart.example"],
 ["MoneyMitra","Micro-loans via an NBFC partner","Fintech","shut_down",["credit"],"moneymitra.example"],
 ["PetPal","Pet food and care brand","Consumer brand","active",["pets"],"petpal.example"],
].map(([name,one,sector,status,tags,domain]) => ({ name, one_liner: one, sector, status, tags, domain,
  source_url: `https://${domain}`, source_note: "Fictional seed company" }));

const m = (company: string, outcome: "invested"|"passed", what: string, founder: string, risks: string, why: string) => ({ company, outcome, what, founder, risks, why });
export const MEMOS = [
 m("Ghee & Co","invested","Direct-to-consumer A2 ghee brand.","Founder tracks repeat by monthly cohort and quotes margin per jar from memory.","Dairy supply is seasonal.","Cohort fluency and a 48% month-3 repeat."),
 m("FlashGlow","passed","Skincare brand growing on paid social.","Founders never tracked repeat; CAC rising 3x in a year.","No cohort data at all.","Missing repeat data; growth bought, not earned."),
 m("FieldCredit","invested","Loans for dairy farmers.","Founder rode with collection agents for a year before launch and carries first loss.","Seasonal repayment.","Founder owns the credit risk."),
 m("EasyLoan","passed","App-based personal loans.","Founder said defaults are the NBFC partner's problem.","Zero first-loss exposure; partner can exit.","Does not own the hardest risk."),
 m("AeroSense","invested","Industrial emissions sensors.","Team ex-lab with a dated milestone path and two pilots.","Certification takes 18 months.","Clear milestones; credibility from pilots not titles."),
 m("SkyEye Drones","passed","Surveillance drones.","Credentials only; no customers or milestones.","No path to revenue.","Pedigree without evidence."),
 m("CoinBridge","passed","Crypto remittance.","Capable team.","Business exists only if regulation changes.","Regulatory bet."),
 m("HeavyRent","passed","Equipment rental marketplace.","Strong founders.","Capital intensive; wrong structure for a pre-seed cheque.","Pass on structure, not people."),
 m("CopyCat AI","passed","AI note taker.","Founder got defensive when asked about a funded copier.","Weak moat.","Defensiveness on a weak spot."),
 m("ShelfSense","invested","Retail shelf analytics for kirana.","Founder visited 120 stores before building.","Small ticket size.","Customer groundwork first."),
 m("QuickKurta","passed","Fast-fashion app.","Downloads-led growth.","No retention numbers.","Missing numbers lower the score."),
 m("RuralPay","invested","Merchant payments in small towns.","Founder numerate on unit economics.","Thin margins.","Founder behaviour beat the sector label."),
];

export const MEETINGS = [1,2,3,4,5].map(n => ({ n, title: `Partner meeting ${n} (fictional)`, notes: [
 "Kushal: our public line says fintech, deeptech, consumer tech and consumer brands, but what we actually back is founders who own the hardest risk.",
 "Aditya: I care about milestone paths in deeptech more than titles. A drone team with no customers is a pass.",
 "Kushal: a missing number should lower the score, never be skipped.",
 ["We treat a false alarm on a portfolio conflict as better than a missed conflict.","Call slots are Tuesday or Thursday afternoons IST, 30 minutes, and Aditya joins deeptech calls.","Consumer brands are judged on cohort repeat and margin fluency.","No company whose existence depends on a regulatory change going its way.","Defensiveness on a weak spot is information."][n-1]].join("\n") }));
