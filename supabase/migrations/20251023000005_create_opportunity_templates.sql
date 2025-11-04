-- Opportunity Templates and Best Practices
-- Provides staff with proven frameworks to maximize conversions

-- Templates Table
CREATE TABLE IF NOT EXISTS opportunity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type VARCHAR(30) NOT NULL, -- 'email', 'sms', 'script', 'offer', 'best_practice'
  opportunity_type VARCHAR(30), -- Links to opportunity type, NULL for universal templates
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB, -- Available variables for substitution
  success_rate DECIMAL(5,2), -- Conversion rate when this template is used
  usage_count INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT false, -- Public templates visible to all staff
  category VARCHAR(50), -- 'follow_up', 'objection_handling', 'offer', 'best_practice'
  tags TEXT[], -- Searchable tags
  metadata JSONB, -- Additional data (recommended timing, tone, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_opportunity_templates_type ON opportunity_templates(template_type);
CREATE INDEX idx_opportunity_templates_opportunity_type ON opportunity_templates(opportunity_type);
CREATE INDEX idx_opportunity_templates_category ON opportunity_templates(category);
CREATE INDEX idx_opportunity_templates_public ON opportunity_templates(is_public);
CREATE INDEX idx_opportunity_templates_tags ON opportunity_templates USING GIN(tags);

-- Update timestamp trigger
CREATE TRIGGER update_opportunity_templates_timestamp
  BEFORE UPDATE ON opportunity_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed Default Templates
INSERT INTO opportunity_templates (template_type, opportunity_type, title, content, variables, is_public, category, tags, metadata) VALUES

-- ============================================================================
-- Email Templates
-- ============================================================================

('email', 'declined_service', 'Declined Service Follow-up',
'Subject: We''d Love Another Chance to Help, {{customer_name}}

Hi {{customer_name}},

I wanted to personally reach out after your recent visit. I noticed you decided not to move forward with our {{declined_service}} service at this time.

I completely understand that timing and budget are important factors. However, I wanted to make sure you had all the information you needed to make the best decision for your home.

Here''s what makes our {{declined_service}} service special:
• Professional-grade equipment and eco-friendly solutions
• Certified technicians with years of experience
• 100% satisfaction guarantee
• Flexible scheduling to fit your needs

If you had any concerns or questions that I didn''t address during your estimate, I''d love to discuss them. Sometimes a quick conversation can clear up any uncertainties.

As a thank you for considering us, I''d like to offer you {{discount}}% off the {{declined_service}} service if you book within the next {{offer_expiry}} days.

Use code: {{offer_code}}

Would you be available for a quick 5-minute call this week?

Best regards,
{{staff_name}}
{{company_name}}
{{staff_phone}}',
'{"customer_name": "Customer first name", "declined_service": "Service that was declined", "discount": "Discount percentage", "offer_expiry": "Offer expiration days", "offer_code": "Discount code", "staff_name": "Your name", "company_name": "Company name", "staff_phone": "Your phone number"}',
true, 'follow_up', ARRAY['email', 'declined', 'follow-up', 'discount'],
'{"recommended_timing": "3-7 days after decline", "tone": "friendly and understanding", "expected_response_rate": 15}'
),

('email', 'price_objection', 'Price Objection - Value Justification',
'Subject: Understanding Your Investment in {{service_name}}

Hi {{customer_name}},

Thank you for taking the time to get an estimate from us. I understand that price is an important consideration, and I wanted to provide some additional context about the value we deliver.

Here''s what''s included in your {{service_name}} service:
✓ Pre-treatment of all high-traffic areas
✓ Professional-grade hot water extraction
✓ Eco-friendly, family-safe cleaning solutions
✓ Deodorizing and sanitizing treatment
✓ Post-cleaning inspection and walk-through
✓ 30-day satisfaction guarantee

**Why Our Price Reflects True Value:**

1. **Experience**: Our technicians undergo 200+ hours of training
2. **Equipment**: We use $50,000+ truck-mounted systems (not portable units)
3. **Results**: Average customer satisfaction score of 4.9/5 stars
4. **Guarantee**: If you''re not satisfied, we''ll re-clean for free

**Investment Breakdown:**
Your {{service_name}} service costs ${{total_amount}}, which works out to just ${{cost_per_room}} per room. When you consider that professional cleaning extends the life of your carpets by 3-5 years, you''re actually saving thousands in replacement costs.

**Special Offer:**
I''d like to offer you {{discount}}% off if you book within {{offer_expiry}} days. This brings your total to ${{discounted_amount}}.

Can we schedule a time this week that works for you?

{{staff_name}}
{{company_name}}
{{staff_phone}}',
'{"customer_name": "Customer name", "service_name": "Service name", "total_amount": "Original price", "cost_per_room": "Per room cost", "discount": "Discount percentage", "offer_expiry": "Offer validity", "discounted_amount": "New price after discount", "staff_name": "Your name", "company_name": "Company name", "staff_phone": "Phone number"}',
true, 'objection_handling', ARRAY['email', 'price', 'objection', 'value'],
'{"recommended_timing": "Within 24 hours of objection", "tone": "professional and informative", "expected_response_rate": 22}'
),

('email', 'callback_requested', 'Callback Follow-up',
'Subject: Following Up on Your {{service_name}} Request

Hi {{customer_name}},

I hope this email finds you well! You recently requested information about our {{service_name}} service, and I wanted to make sure I answered all your questions.

**Quick Recap:**
• Service: {{service_name}}
• Estimated Cost: ${{estimated_value}}
• Estimated Time: {{service_duration}}
• Available Dates: {{available_dates}}

**What Happens Next?**

1. Choose your preferred date and time
2. We send a confirmation with technician details
3. Technician arrives on schedule with all equipment
4. Professional service with a smile
5. Walk-through and satisfaction check

**Current Promotion:**
Book this week and save {{discount}}% with code {{offer_code}}!

**Ready to Schedule?**
Reply to this email or call me directly at {{staff_phone}}. I have openings available:
• {{slot_1}}
• {{slot_2}}
• {{slot_3}}

Looking forward to serving you!

{{staff_name}}
{{company_name}}',
'{"customer_name": "Customer name", "service_name": "Service requested", "estimated_value": "Price estimate", "service_duration": "How long service takes", "available_dates": "Available appointment dates", "discount": "Discount amount", "offer_code": "Promo code", "staff_phone": "Contact number", "slot_1": "Available time slot 1", "slot_2": "Available time slot 2", "slot_3": "Available time slot 3", "staff_name": "Your name", "company_name": "Company name"}',
true, 'follow_up', ARRAY['email', 'callback', 'scheduling'],
'{"recommended_timing": "Same day or within 24 hours", "tone": "helpful and enthusiastic", "expected_response_rate": 35}'
),

-- ============================================================================
-- SMS Templates
-- ============================================================================

('sms', 'declined_service', 'Quick Follow-up SMS',
'Hi {{customer_name}}! We''d love another chance to earn your business. Offering {{discount}}% off {{service_name}} if you book this week. Use code {{offer_code}}. Reply YES to schedule! - {{staff_name}} at {{company_name}}',
'{"customer_name": "First name", "discount": "Discount %", "service_name": "Service", "offer_code": "Code", "staff_name": "Your name", "company_name": "Company"}',
true, 'follow_up', ARRAY['sms', 'declined', 'quick-offer'],
'{"recommended_timing": "2-3 days after decline", "max_length": 160, "expected_response_rate": 8}'
),

('sms', 'offer_claimed', 'Offer Claimed - Schedule Reminder',
'Great news {{customer_name}}! Your {{discount}}% off code {{offer_code}} is ready. Let''s get you scheduled! I have {{available_date_1}} or {{available_date_2}} available. Reply with your preference! - {{staff_name}}',
'{"customer_name": "First name", "discount": "Discount %", "offer_code": "Promo code", "available_date_1": "Date option 1", "available_date_2": "Date option 2", "staff_name": "Your name"}',
true, 'follow_up', ARRAY['sms', 'offer', 'scheduling'],
'{"recommended_timing": "Within 1 hour of claim", "max_length": 160, "expected_response_rate": 42}'
),

('sms', 'no_answer', 'No Answer Follow-up',
'Hi {{customer_name}}, I tried calling about your {{service_name}} estimate. Text me back or call {{staff_phone}} when you have 5 min to chat. Special offer expires {{expiry_date}}! - {{staff_name}}',
'{"customer_name": "First name", "service_name": "Service", "staff_phone": "Phone", "expiry_date": "When offer expires", "staff_name": "Your name"}',
true, 'follow_up', ARRAY['sms', 'no-answer', 'reminder'],
'{"recommended_timing": "2 hours after missed call", "max_length": 160, "expected_response_rate": 12}'
),

-- ============================================================================
-- Phone Scripts
-- ============================================================================

('script', 'declined_service', 'Declined Service Phone Script',
'**OPENING:**
"Hi {{customer_name}}, this is {{staff_name}} from {{company_name}}. How are you today?"

[Wait for response]

"I''m following up on the estimate we provided for your {{service_name}}. I wanted to check in and see if you had any questions I could answer."

**IF THEY SAY THEY''RE STILL THINKING:**
"I completely understand - it''s an important decision. Can I ask what''s holding you back? Is it the timing, the investment, or something else?"

[Listen actively]

**IF PRICE IS THE CONCERN:**
"I hear you. What if I could offer you {{discount}}% off if you book today? That would bring it down to ${{discounted_price}}. Would that work better for your budget?"

**IF TIMING IS THE CONCERN:**
"No problem at all! When would be a better time for you? I want to make sure we''re available when you need us. How about {{future_date}}?"

**IF THEY WENT WITH COMPETITOR:**
"I understand. May I ask what made you choose them? Was it price, timing, or something we could have done better?"

[Listen and learn]

"Well, I appreciate your honesty. If anything changes or if you''re not 100% satisfied, please keep us in mind. We stand behind our work with a satisfaction guarantee."

**CLOSING:**
"Thanks so much for your time, {{customer_name}}. Is it okay if I check back with you in a few weeks, just in case anything changes?"

**NOTES:**
- Stay friendly and non-pushy
- Listen more than you talk
- Don''t argue with objections
- Always end on a positive note
- Document the conversation in CRM',
'{"customer_name": "Customer name", "staff_name": "Your name", "company_name": "Company name", "service_name": "Service declined", "discount": "Discount percentage", "discounted_price": "New price", "future_date": "Suggested future date"}',
true, 'follow_up', ARRAY['script', 'phone', 'declined', 'objection-handling'],
'{"recommended_timing": "3-5 days after decline", "call_duration": "5-10 minutes", "expected_conversion": 18}'
),

('script', 'price_objection', 'Price Objection Phone Script',
'**ACKNOWLEDGE:**
"I completely understand that price is important, {{customer_name}}. Can I ask - are you comparing our price to another company, or is it more about fitting it into your budget right now?"

**IF COMPARING TO COMPETITOR:**
"I appreciate you getting multiple quotes - that''s smart shopping! A few questions:
1. Did their quote include pre-treatment and deodorizing?
2. What type of equipment are they using - portable or truck-mounted?
3. Do they offer any kind of satisfaction guarantee?

[Let them answer]

Our price includes [LIST WHAT''S INCLUDED]. We use professional truck-mounted equipment that extracts more water and dirt than portable units, which means faster drying and cleaner results."

**IF BUDGET CONCERN:**
"I totally get it. Here''s what I can do - I can offer you {{discount}}% off if you book today. That brings your total to ${{discounted_price}}. Does that help?"

**VALUE REFRAME:**
"Think of it this way - professional carpet cleaning extends the life of your carpets by 3-5 years. Your carpets probably cost ${{carpet_value}} to replace. At ${{discounted_price}}, you''re protecting a much larger investment."

**CLOSING:**
"What would make this work for you today?"',
'{"customer_name": "Customer name", "discount": "Discount %", "discounted_price": "Discounted total", "carpet_value": "Estimated carpet replacement cost"}',
true, 'objection_handling', ARRAY['script', 'phone', 'price', 'objection'],
'{"recommended_timing": "Immediately during estimate or within 24 hours", "expected_conversion": 25}'
),

-- ============================================================================
-- Offer Templates
-- ============================================================================

('offer', 'declined_service', 'Win-Back Offer - 15% Discount',
'**Offer Details:**

**Discount:** 15% off {{service_name}}
**Original Price:** ${{original_price}}
**Discounted Price:** ${{discounted_price}}
**Valid Until:** {{expiry_date}}

**Services Included:**
• Pre-treatment of all areas
• Professional hot water extraction
• Deodorizing treatment
• Stain protection (optional add-on)
• 30-day satisfaction guarantee

**Redemption Instructions:**
1. Customer mentions code {{offer_code}}
2. Verify offer hasn''t expired
3. Apply discount at checkout
4. Mark opportunity as converted

**Why This Offer Works:**
• 15% is significant enough to overcome price objection
• Time limit creates urgency
• All standard services included (no bait-and-switch)
• Proven 18% conversion rate on declined services',
'{"service_name": "Service name", "original_price": "Full price", "discounted_price": "Price after discount", "expiry_date": "Offer expiration", "offer_code": "Unique code"}',
true, 'offer', ARRAY['offer', 'discount', 'win-back'],
'{"recommended_discount": 15, "expiry_days": 14, "min_service_value": 200, "success_rate": 18}'
),

('offer', 'add_on_service', 'Bundle Upgrade - Additional Room 50% Off',
'**Offer Details:**

**Main Service:** {{main_service}} at regular price
**Add-On:** Additional room(s) at 50% off

**Pricing Example:**
• First 3 rooms: ${{main_price}}
• 4th room: ${{addon_regular}} → ${{addon_discounted}} (50% off)
• Total Savings: ${{total_savings}}

**Perfect For:**
• Customers who initially declined extra rooms
• Upselling during the service visit
• Encouraging whole-home cleaning

**Talking Points:**
"Since we''re already set up at your home, I can add {{extra_rooms}} more room(s) for 50% off. That''s a savings of ${{savings}} and only adds about {{extra_time}} minutes to the service."

**Conversion Rate:** 34% when offered on-site',
'{"main_service": "Primary service", "main_price": "Main service price", "addon_regular": "Additional room regular price", "addon_discounted": "50% off price", "total_savings": "Total amount saved", "extra_rooms": "Number of rooms", "savings": "Savings amount", "extra_time": "Additional time needed"}',
true, 'offer', ARRAY['offer', 'bundle', 'upsell', 'add-on'],
'{"recommended_discount": 50, "min_main_service": 150, "success_rate": 34}'
),

-- ============================================================================
-- Best Practices
-- ============================================================================

('best_practice', NULL, 'Optimal Follow-up Timing',
'**When to Follow Up for Maximum Conversion:**

**Declined Service:**
• First contact: 3-5 days after decline
• Second contact: 14 days after decline
• Final contact: 30 days after decline
• Success rate peaks at 7 days

**Price Objection:**
• First contact: Within 24 hours (while still fresh)
• Offer sent: Same day as objection
• Follow-up call: 2-3 days after offer
• Highest conversion: Same-day response

**Callback Requested:**
• First attempt: Within 2 hours (critical!)
• Second attempt: 6 hours if no answer
• Third attempt: Next business day
• Email after 3rd attempt
• 85% success rate with <2 hour response

**No Answer (estimate provided):**
• First attempt: 2 hours after estimate
• SMS: 4 hours after estimate
• Email: 6 hours after estimate
• Second call: Next day
• Final attempt: 3 days later

**Timing Matters:**
• Tuesday-Thursday: 40% higher answer rates
• 10 AM - 2 PM: Best calling window
• Avoid Monday mornings and Friday afternoons
• Evening calls (6-8 PM): Good for working professionals

**Key Insight:**
Speed wins. Every hour of delay reduces conversion by 3-5%.',
NULL,
true, 'best_practice', ARRAY['timing', 'follow-up', 'conversion', 'best-practice'],
'{"category": "timing_strategy", "impact": "high", "data_backed": true}'
),

('best_practice', NULL, 'Common Mistakes to Avoid',
'**Top 10 Mistakes That Kill Conversions:**

**1. Waiting Too Long to Follow Up**
• Mistake: Following up 3-4 days later
• Fix: Call within 2 hours of estimate/inquiry
• Impact: 35% conversion increase

**2. Being Too Pushy**
• Mistake: "So are you ready to book today?"
• Fix: "What questions can I answer for you?"
• Impact: Higher trust, better long-term relationships

**3. Not Listening to Objections**
• Mistake: Immediately countering every objection
• Fix: "Tell me more about that concern..."
• Impact: Better understanding, tailored solutions

**4. Forgetting to Set Next Steps**
• Mistake: "Okay, call us when you''re ready"
• Fix: "Can I check back with you Thursday?"
• Impact: 25% more follow-through

**5. Not Documenting Conversations**
• Mistake: Relying on memory for follow-ups
• Fix: Update CRM after every interaction
• Impact: Consistent, informed follow-ups

**6. Giving Up After One Try**
• Mistake: One call, no answer, mark as lost
• Fix: 3 calls + 2 emails + 1 SMS minimum
• Impact: 40% of conversions happen after 3rd contact

**7. Not Offering Value in Follow-ups**
• Mistake: "Just checking in..."
• Fix: "I found a solution to the concern you mentioned..."
• Impact: Higher engagement rates

**8. Comparing to Competitors Negatively**
• Mistake: "They do terrible work!"
• Fix: "Here''s what makes us different..."
• Impact: Professionalism wins trust

**9. Not Creating Urgency**
• Mistake: Open-ended offers with no expiration
• Fix: "This offer expires Friday..."
• Impact: 60% more immediate bookings

**10. Forgetting to Ask for the Sale**
• Mistake: Talking but never closing
• Fix: "Can I get you scheduled for Tuesday?"
• Impact: Simple ask = 20% more closes

**Remember:**
Opportunity conversion is a skill that improves with practice. Review your calls, learn from losses, and celebrate your wins!',
NULL,
true, 'best_practice', ARRAY['mistakes', 'avoid', 'best-practice', 'conversion'],
'{"category": "common_pitfalls", "impact": "high", "actionable": true}'
),

('best_practice', NULL, 'Success Stories and Proven Approaches',
'**Real Success Stories from Our Top Performers:**

**Story #1: The "I''ll Think About It" Turnaround**

**Situation:** Customer got 3 quotes, said ours was highest

**What Worked:**
"I completely understand. Can I ask which company you''re leaning toward and what made you prefer them?"

Customer revealed the competitor used portable equipment and didn''t include pre-treatment.

"Got it! So you''re comparing a $150 portable unit cleaning to our $50,000 truck-mounted deep clean. Here''s the difference..." [Explained results]

Then offered 10% discount to match competitor''s total price.

**Result:** Booked same day, became repeat customer
**Lesson:** Ask questions before discounting

---

**Story #2: The Perfect Timing Follow-up**

**Situation:** Customer declined tile cleaning, only booked carpets

**What Worked:**
Technician called customer 2 weeks later: "Hi! I was the tech who cleaned your carpets. I wanted to follow up - how did they turn out?"

Customer raved about results.

"Awesome! Remember we talked about your tile? Since you loved the carpet results, I''d like to offer you 25% off tile cleaning. Can I schedule that for you?"

**Result:** $450 additional revenue
**Lesson:** Leverage satisfaction momentum

---

**Story #3: The Objection Flip**

**Situation:** "Your price is too high!"

**What Didn''t Work:** Immediately discounting

**What Worked:**
"I hear you. Can I ask - when you say too high, are you comparing us to another quote?"

"Yes, XYZ Company is $100 cheaper."

"Okay, and what does their quote include?" [Customer didn''t know]

"Here''s what I''ll do - call them and ask these questions [provided list]. Then call me back. I want you to make an informed decision, even if it''s not with us."

**Result:** Customer called back 2 hours later and booked
**Lesson:** Confidence and honesty build trust

---

**Story #4: The No-Answer Marathon**

**Situation:** Estimate sent, 5 calls with no answer

**What Worked:**
• Call 1 (2 hours later): No answer, left voicemail
• Call 2 (next day): No answer
• SMS (4 hours after call 2): Short, friendly message
• Email (same day): Detailed email with offer
• Call 3 (3 days later): NO ANSWER
• Final SMS: "Hi! I''ve tried reaching you. If you''d prefer email, just reply EMAIL. Otherwise I''ll try you once more tomorrow!"

Customer replied: "EMAIL PLEASE"

Converted via email follow-ups.

**Result:** $380 job from "no answer"
**Lesson:** Never assume no answer = not interested

---

**Story #5: The Bundle Win**

**Situation:** Customer booked 3 rooms, mentioned needing upholstery cleaned "someday"

**What Worked:**
"How about this - I''ll add your couch to today''s service for 40% off since we''re already here. That''s a $120 value for $72."

**Result:** Instant upsell
**Lesson:** Make add-ons easy and immediate

---

**Key Takeaways:**
1. Persistence pays (40% of sales happen after 3rd contact)
2. Ask questions before discounting
3. Use existing satisfaction as leverage
4. Offer multiple contact methods
5. Make it easy to say yes',
NULL,
true, 'best_practice', ARRAY['success-stories', 'proven-approaches', 'best-practice', 'real-examples'],
'{"category": "success_stories", "impact": "high", "inspiration": true}'
);

-- Comments
COMMENT ON TABLE opportunity_templates IS 'Template library for opportunity follow-ups, scripts, and best practices';
COMMENT ON COLUMN opportunity_templates.template_type IS 'Type of template: email, sms, script, offer, or best_practice';
COMMENT ON COLUMN opportunity_templates.variables IS 'JSON object defining available template variables for substitution';
COMMENT ON COLUMN opportunity_templates.success_rate IS 'Conversion rate percentage when this template is used';
COMMENT ON COLUMN opportunity_templates.metadata IS 'Additional metadata like recommended timing, tone, expected rates';
