# Dispatcher Training Guide

## Table of Contents

- [Role Overview](#role-overview)
- [Day-1 Quick Start](#day-1-quick-start)
- [Customer Management](#customer-management)
- [Job Management](#job-management)
- [Scheduling & Calendar](#scheduling--calendar)
- [Zone Board Operations](#zone-board-operations)
- [Reminders Inbox](#reminders-inbox)
- [SMS Communication](#sms-communication)
- [Vehicle & Resource Management](#vehicle--resource-management)
- [Reports & Analytics](#reports--analytics)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Role Overview

As a **Dispatcher**, you are the operational hub of Dirt Free CRM. Your responsibilities include:

- **Customer Relations**: Managing customer information and communications
- **Job Coordination**: Creating, assigning, and tracking service jobs
- **Schedule Management**: Optimizing technician schedules and resolving conflicts
- **SMS Communications**: Sending appointments reminders and updates
- **Resource Allocation**: Managing vehicles, equipment, and technician assignments
- **Quality Assurance**: Ensuring service standards and customer satisfaction

### Key Access & Permissions

✅ **Customer Management**: Full access to all customer data
✅ **Job Management**: Create, edit, and assign all jobs
✅ **Scheduling**: Calendar management and conflict resolution
✅ **Zone Board**: Drag-and-drop job assignments
✅ **SMS & Reminders**: Send communications and manage reminders
✅ **Vehicle Board**: Monitor and assign vehicles
✅ **Reports**: Limited reporting access for operational metrics

❌ **User Management**: Cannot create/edit user accounts
❌ **System Settings**: Cannot modify global configurations
❌ **Audit Logs**: Cannot access system audit trails

## Day-1 Quick Start

### Initial Login & Orientation

1. **Login to System**
   - URL: `https://dirt-free-crm.com`
   - Use provided dispatcher credentials
   - Familiarize yourself with the dashboard layout

2. **Dashboard Overview**
   - **Today's Schedule**: Jobs scheduled for today
   - **Pending Reminders**: Customer communications due
   - **Active Jobs**: Currently in-progress work
   - **Quick Actions**: Common tasks and shortcuts

3. **Key Navigation Areas**
   - **Customers**: Customer database and management
   - **Jobs**: Job creation and tracking
   - **Schedule**: Calendar view of all appointments
   - **Zone Board**: Visual job assignment interface
   - **Reminders**: SMS and communication inbox
   - **Reports**: Operational reports and metrics

### Essential Day-1 Tasks Checklist

- [ ] Complete initial login and password setup
- [ ] Review today's scheduled jobs
- [ ] Check pending reminders and communications
- [ ] Verify technician schedules and assignments
- [ ] Test SMS functionality with a test message
- [ ] Familiarize yourself with customer search
- [ ] Practice creating a sample job
- [ ] Review zone board layout and assignments
- [ ] Check vehicle availability and assignments
- [ ] Review emergency contact procedures

## Customer Management

### Customer Database

**Accessing Customers:**
```
Navigation → Customers
```

**Customer Information Fields:**
- **Basic Info**: Name, phone, email, address
- **Service History**: Past jobs and interactions
- **Preferences**: Scheduling preferences, special instructions
- **Communication Log**: SMS history and notes
- **Billing Info**: Payment methods and history

### Adding New Customers

**Customer Creation Process:**
1. Click **"Add New Customer"**
2. **Required Fields:**
   - Full name
   - Phone number (primary contact)
   - Service address
3. **Optional Fields:**
   - Email address
   - Billing address (if different)
   - Special instructions
   - Preferred contact method

**Best Practices:**
- Always verify phone number format: `(555) 123-4567`
- Check for existing customers before creating duplicates
- Add special instructions for access, pets, or preferences
- Update emergency contact information

### Customer Search & Management

**Search Methods:**
- **Name Search**: Type customer name in search bar
- **Phone Search**: Enter phone number (formatted or unformatted)
- **Address Search**: Search by service address
- **Advanced Filters**: Filter by zone, service type, last service date

**Editing Customer Information:**
1. Search and select customer
2. Click **"Edit Customer"**
3. Update information as needed
4. **Save Changes**

**Customer Notes:**
- Add service notes and preferences
- Document special access instructions
- Record customer communication preferences
- Note any issues or concerns

### Customer Communication History

**Viewing Communication Log:**
- SMS history with timestamps
- Call logs and notes
- Email correspondence
- Service feedback and reviews

**Adding Manual Notes:**
- Click **"Add Note"** in customer profile
- Select note type (call, meeting, issue, etc.)
- Enter detailed information
- Save with timestamp

## Job Management

### Creating New Jobs

**Job Creation Workflow:**
1. **Customer Selection**
   - Search existing customer or create new
   - Verify contact and address information

2. **Service Details**
   - **Service Type**: Carpet cleaning, upholstery, etc.
   - **Service Area**: Rooms/areas to be cleaned
   - **Estimated Duration**: Time required for completion
   - **Special Instructions**: Access codes, pet information, etc.

3. **Scheduling**
   - **Preferred Date/Time**: Customer preferences
   - **Technician Assignment**: Select available technician
   - **Zone Assignment**: Assign to appropriate service zone

4. **Pricing & Notes**
   - **Estimated Price**: Based on service scope
   - **Internal Notes**: Information for technician
   - **Customer Notes**: Information shared with customer

### Job Assignment & Scheduling

**Technician Assignment:**
- Review technician availability
- Consider zone proximity and travel time
- Check skill requirements and certifications
- Balance workload across team

**Zone Management:**
- Assign jobs to appropriate zones
- Optimize travel routes and efficiency
- Consider geographic constraints
- Monitor zone capacity and balance

### Job Status Management

**Job Status Workflow:**
1. **Scheduled** → Job created and assigned
2. **Confirmed** → Customer confirmation received
3. **On the Way** → Technician en route
4. **In Progress** → Work has begun
5. **Completed** → Service finished
6. **Follow-up** → Post-service communication

**Status Updates:**
- Automatic updates from technician mobile app
- Manual updates via job management interface
- Real-time notifications to customers
- Audit trail of all status changes

### Job Modifications

**Rescheduling Jobs:**
1. Open job details
2. Click **"Reschedule"**
3. Select new date/time
4. Update technician assignment if needed
5. Send notification to customer and technician

**Reassigning Jobs:**
1. Open Zone Board or job details
2. Drag job to new technician or use assignment dropdown
3. Confirm assignment change
4. System automatically notifies relevant parties

**Canceling Jobs:**
1. Open job details
2. Click **"Cancel Job"**
3. Select cancellation reason
4. Add notes if necessary
5. Notify customer and technician

## Scheduling & Calendar

### Calendar Views

**Available Views:**
- **Daily View**: Hour-by-hour schedule for specific date
- **Weekly View**: Week overview with all technicians
- **Monthly View**: High-level monthly overview
- **Technician View**: Individual technician schedules

**Calendar Navigation:**
- Use date picker for specific dates
- Navigate with arrow buttons (previous/next)
- Filter by technician, zone, or job type
- Search for specific jobs or customers

### Conflict Detection & Resolution

**Scheduling Conflicts:**
- **Double-booking**: Same technician, overlapping times
- **Travel Time**: Insufficient time between appointments
- **Zone Conflicts**: Jobs too far apart geographically
- **Skill Mismatch**: Job requires specific training

**Conflict Resolution:**
1. **Identify Conflict**: System highlights potential issues
2. **Review Options**: Suggested alternative times/assignments
3. **Adjust Schedule**: Modify time, date, or technician
4. **Confirm Changes**: Verify resolution addresses conflict
5. **Notify Parties**: Send updates to customer and technician

### Appointment Optimization

**Best Practices:**
- Group jobs by geographic zone
- Allow adequate travel time between appointments
- Consider job complexity and duration
- Balance workload across technicians
- Reserve time for emergency calls

**Time Slot Management:**
- **Morning Slots**: 8:00 AM - 12:00 PM
- **Afternoon Slots**: 1:00 PM - 5:00 PM
- **Emergency Slots**: Reserve 10% capacity for urgent jobs
- **Buffer Time**: 15-30 minutes between appointments

## Zone Board Operations

### Zone Board Overview

The Zone Board provides a visual interface for managing job assignments across service zones and technicians.

**Board Layout:**
- **Zones**: Geographic service areas (Zone A, B, C, etc.)
- **Technicians**: Individual team members
- **Job Cards**: Visual representation of scheduled work
- **Status Indicators**: Color-coded job statuses

### Drag-and-Drop Functionality

**Moving Jobs Between Zones:**
1. Click and hold job card
2. Drag to target zone column
3. Drop in desired position
4. System updates assignment and notifies parties

**Reassigning Between Technicians:**
1. Locate job card in current assignment
2. Drag to different technician section
3. Confirm assignment change
4. System logs change and sends notifications

**Status Changes:**
- Drag jobs between status columns
- Update progress visually
- Automatic timestamp recording
- Real-time updates across system

### Zone Optimization

**Workload Balancing:**
- Monitor job distribution across zones
- Identify overloaded or underutilized areas
- Redistribute work for optimal efficiency
- Consider skill sets and specializations

**Route Planning:**
- Group nearby jobs for same technician
- Minimize travel time and fuel costs
- Consider traffic patterns and timing
- Plan logical service sequences

## Reminders Inbox

### Reminder Management

**Accessing Reminders:**
```
Navigation → Reminders → Inbox
```

**Reminder Types:**
- **Appointment Reminders**: Day-before confirmations
- **On-the-Way Notifications**: Technician en route updates
- **Follow-up Messages**: Post-service communications
- **Marketing Messages**: Promotional and retention communications

### Processing Reminders

**Send Now:**
1. Select reminder from inbox
2. Review message content and recipient
3. Click **"Send Now"**
4. Confirm sending
5. Monitor delivery status

**Snooze Reminder:**
1. Select reminder to delay
2. Choose snooze duration (1 hour, 4 hours, 1 day, etc.)
3. Add optional note for context
4. Confirm snooze action

**Edit Message:**
1. Select reminder to modify
2. Click **"Edit Message"**
3. Customize content while maintaining key information
4. Preview message
5. Save changes or send immediately

**Mark Complete:**
- For reminders that don't require SMS sending
- Manually mark as completed with notes
- Useful for phone calls or in-person communications

### Bulk Reminder Actions

**Selecting Multiple Reminders:**
- Use checkboxes to select multiple reminders
- Select all reminders with checkbox header
- Filter and select by criteria

**Bulk Operations:**
- **Send All**: Send multiple reminders at once
- **Snooze All**: Delay multiple reminders
- **Mark Complete**: Complete multiple reminders
- **Delete**: Remove unnecessary reminders

## SMS Communication

### SMS Best Practices

**Professional Communication:**
- Use clear, concise language
- Include relevant details (time, date, technician name)
- Always include company identification
- Provide contact information for questions
- Include opt-out instructions per compliance requirements

**Message Templates:**
- Use pre-approved templates for consistency
- Customize with customer-specific details
- Maintain professional tone
- Keep messages under 160 characters when possible

### Compliance Requirements

**STOP/START Management:**
- Honor STOP requests immediately
- Process START requests to re-enable
- Maintain opt-out list accuracy
- Document all compliance actions

**Quiet Hours (9 PM - 8 AM Central Time):**
- System automatically defers messages during quiet hours
- Messages scheduled for next business hour (8 AM CT)
- Emergency messages may override (with approval)
- Monitor compliance in reports

**Message Content Guidelines:**
- Include clear identification of sender
- Provide opt-out instructions
- Avoid excessive messaging frequency
- Use appropriate language and tone

### SMS Delivery Monitoring

**Delivery Status Tracking:**
- **Sent**: Message delivered to carrier
- **Delivered**: Confirmed delivery to recipient
- **Failed**: Delivery unsuccessful
- **Blocked**: Number on opt-out list

**Failed Message Handling:**
1. Review failure reason (invalid number, carrier issue, etc.)
2. Verify customer phone number accuracy
3. Attempt alternative contact method if needed
4. Update customer record with current information

## Vehicle & Resource Management

### Vehicle Board

**Accessing Vehicle Management:**
```
Navigation → Vehicles → Board
```

**Vehicle Information:**
- **Vehicle ID**: Truck number or identifier
- **Assigned Technician**: Current driver/operator
- **Status**: Available, in-use, maintenance, etc.
- **Location**: Current or last known location
- **Equipment**: Onboard tools and supplies

### Vehicle Assignment

**Assigning Vehicles:**
1. View available vehicles
2. Select technician needing vehicle
3. Drag vehicle to technician or use assignment dropdown
4. Confirm assignment
5. System records assignment time and details

**Vehicle Status Updates:**
- **Available**: Ready for assignment
- **In Use**: Currently assigned and active
- **Maintenance**: Scheduled or emergency maintenance
- **Out of Service**: Temporarily unavailable

### Equipment & Supply Tracking

**Equipment Management:**
- Track equipment location and status
- Monitor supply levels and needs
- Schedule maintenance and inspections
- Document issues and repairs

**Inventory Monitoring:**
- Cleaning supplies and chemicals
- Equipment condition and availability
- Replacement needs and scheduling
- Cost tracking and budgeting

## Reports & Analytics

### Available Reports

**Daily Operations:**
- Jobs scheduled and completed
- Technician productivity
- Customer communications sent
- Revenue and collection metrics

**Weekly Performance:**
- Completion rates and trends
- Customer satisfaction scores
- Response time analysis
- Resource utilization

**Monthly Summary:**
- Business performance metrics
- Customer acquisition and retention
- Operational efficiency measures
- Financial summary and trends

### Generating Reports

**Report Creation:**
1. Navigate to **Reports** section
2. Select report type
3. Choose date range
4. Apply filters (technician, zone, etc.)
5. Generate report
6. Export if needed (PDF/CSV)

**Report Customization:**
- Filter by specific criteria
- Adjust date ranges
- Select specific metrics
- Choose output format

### Key Performance Indicators

**Operational KPIs:**
- **Job Completion Rate**: Target >95%
- **Customer Satisfaction**: Target >4.5/5
- **On-Time Performance**: Target >90%
- **Response Time**: Target <24 hours

**Communication KPIs:**
- **SMS Delivery Rate**: Target >97%
- **Reminder Effectiveness**: Measure response rates
- **Customer Response Time**: Track engagement
- **Opt-out Rate**: Monitor <2%

## Best Practices

### Daily Workflow

**Morning Routine (8:00-9:00 AM):**
1. Review today's schedule and assignments
2. Check overnight messages and reminders
3. Confirm technician availability and readiness
4. Send morning appointment reminders
5. Address any scheduling conflicts or issues

**Midday Check (12:00-1:00 PM):**
1. Monitor job progress and status updates
2. Handle customer inquiries and changes
3. Send "on the way" notifications
4. Address vehicle or equipment issues
5. Prepare afternoon assignments

**End of Day (4:00-5:00 PM):**
1. Review completed jobs and collect feedback
2. Follow up on incomplete or problematic jobs
3. Prepare tomorrow's schedule and reminders
4. Update customer records and notes
5. Generate daily performance summary

### Communication Guidelines

**Customer Interactions:**
- Be professional and courteous at all times
- Listen actively to customer concerns
- Provide clear and accurate information
- Follow up on promises and commitments
- Document all interactions thoroughly

**Team Coordination:**
- Maintain open communication with technicians
- Provide clear instructions and expectations
- Share relevant customer information
- Support team members with challenges
- Coordinate resources and assistance

### Quality Assurance

**Service Standards:**
- Verify all job details before dispatch
- Ensure technicians have necessary information
- Monitor service delivery and quality
- Collect customer feedback actively
- Address issues promptly and professionally

**Continuous Improvement:**
- Track performance metrics regularly
- Identify areas for improvement
- Implement process enhancements
- Share best practices with team
- Stay updated on new features and capabilities

## Troubleshooting

### Common Issues & Solutions

**Customer Cannot Be Reached:**
1. Try alternative contact methods (email, different phone)
2. Check contact information accuracy
3. Leave voicemail with callback request
4. Schedule follow-up attempt
5. Document contact attempts

**Scheduling Conflicts:**
1. Review conflicting appointments
2. Check technician availability and travel time
3. Contact customer to reschedule if necessary
4. Update calendar and notify all parties
5. Document resolution

**SMS Delivery Failures:**
1. Verify phone number format and accuracy
2. Check if number is on opt-out list
3. Review message content for compliance
4. Try resending after corrections
5. Use alternative contact method if needed

**Technician Communication Issues:**
1. Check mobile app connectivity
2. Verify technician has current app version
3. Use direct phone contact if needed
4. Review training on system usage
5. Escalate technical issues to support

### Escalation Procedures

**Customer Complaints:**
1. Listen and document concern
2. Apologize and take ownership
3. Investigate issue thoroughly
4. Propose solution or compensation
5. Follow up to ensure satisfaction
6. Escalate to manager if unresolved

**Technical Issues:**
1. Document specific problem and symptoms
2. Check system status and health
3. Try basic troubleshooting steps
4. Contact technical support if needed
5. Escalate to administrator for system-wide issues

**Emergency Situations:**
1. Assess severity and impact
2. Contact appropriate emergency services if needed
3. Notify management immediately
4. Document incident details
5. Follow company emergency procedures

---

**Last Updated:** [Date] | **Version:** 1.0 | **Next Review:** [Date + 3 months]

<!-- Screenshot placeholders:
- [Dispatcher Dashboard Overview]
- [Customer Management Interface]
- [Job Creation Workflow]
- [Calendar and Scheduling Views]
- [Zone Board Operations]
- [Reminders Inbox Management]
- [SMS Communication Interface]
- [Vehicle Board Layout]
- [Reports Dashboard]
-->