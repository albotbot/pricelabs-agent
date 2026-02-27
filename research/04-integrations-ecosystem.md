# PriceLabs Integrations Ecosystem

> 152+ PMS/OTA/Channel Manager integrations — industry-leading

## Integration Methods

### Direct API (Majority)
- PriceLabs pulls listing data, availability, bookings FROM the PMS
- PriceLabs pushes optimized rates, min-stay rules, restrictions TO the PMS
- Default sync: every 24 hours (6pm-6am Chicago time)
- Pricing window: 540 days default, 720 days max

### iCal
- Calendar synchronization only (not pricing)
- Delay: typically hours to propagate
- Risk of double-bookings during sync window
- Used alongside API for platforms with limited API support

### Customer API (WordPress/Wix)
- Push dynamic prices to direct booking websites
- WordPress plugins: WP Booking System, MotoPress Hotel Booking
- MotoPress updates prices automatically 2x/day
- Custom sites require custom API implementation

---

## Data Flow

### FROM PMS/OTA TO PriceLabs
- Listing details (type, bedrooms, amenities, location)
- Calendar availability and blocked dates
- Existing bookings and reservation data
- Current pricing and rate structure
- Historical booking data

### FROM PriceLabs TO PMS/OTA
- Nightly rate amounts (daily dynamic prices)
- Minimum nights/stay rules
- Arrival/departure restrictions
- Extra person fees (supported PMS only)
- Check-in/check-out restrictions (on request)
- Orphan day/gap rules (on request)

### NOT Managed by PriceLabs
- Calendar blocks
- Cleaning fees
- Additional fees beyond extra person fees
- LOS discounts (handled by PMS)
- Guest count pricing (handled by PMS)

---

## Direct OTA Connections

### Airbnb (Official Software Partner)
- OAuth-based authorization
- Direct API integration
- Prices not pushed until user explicitly enables sync
- Replaces older Chrome extension method

### Booking.com (Certified Connectivity Partner)
- One of few non-PMS platforms with this certification
- Syncs pricing and minimum stay rules
- **Does NOT sync availability** — requires iCal for calendar

### Vrbo
- Integrated through PMS connections or direct
- Rates, min stays, and restrictions pushed through PMS

---

## Complete PMS Integration List (152 as of Feb 2026)

### A
3RPMS, AdvanceCM, AirHost, Apaleo, aPerfect, AvaiBook, Avantio, Avirato, Ayrton

### B
Barefoot, BBPlanner, BedLoop, Beds24, Better Hotel, Bookandlink, Bookerville, Booking Automation, Booking.com (Direct), Bookingmood, Bookipro, Boom, BOUK, BrightSide, Buqipi

### C
Channex, CiaoBooking, CiiRUS, ClickBooking, Cloudbeds

### D-E
Direct, e4jConnect, Egluu, Elina PMS, Escapia, Estar Booking, eviivo, ezCloud

### F
Feather, Felix, Fewo.cloud, FNS Rooms, Freemium, FreeOnlineBooking.com

### G
Galaxy Hotels, GraceSoft, GuestWisely, Guesty, Guesty For Hosts

### H
Homeresa, Homhero, Hoone, HOS Booking, Hospitable, Hostaway, Hosteeva, Hostex, Hostfully, HostHub, Hostify, HostPMS, Hosttools, Hosty, Hotelgest, Hotelizer, Hotres

### I-J
Icnea, IdoBooking, iGMS, iLOCA, Innkeeper's Advantage, iPro Software, Janiis, Jurny

### K-L
Krossbooking, LiveRez (Ignite), LMPM, Lodgify, Lodgix, Loggia, Loomky, LosjiTech

### M
Master Yield, Maxxton, Mews, MiniHotel, MisterBooking, MisterPlan, MotoPress, my-bookings, myRent, MyTourist

### N-O
net2rent, newbook, Octorate, OkupAI, OTA Sync, OwnerRez

### P-Q
Pass the Keys, Previo, PropertyStack, Pxsol, QloApps, QUOVAI

### R
Rentalls, RentalReady, Rentals United, RentalWise, Rentlio, Res:harmonics, Resly, ResNexus, RMS, RNS, Roomadmin, RoomCloud, RoomRaccoon, RoomSoft

### S
SabeeApp, Search and Search, Secra, Shopbnb, Sibo, Smart Order, Smily, Smoobu, STAAH, StayHub, StayNow365, Stayntouch, Stays, Streamline, SuiteClerk, SuperControl, SuperHote

### T-U
Talkguest, Tokeet, Track PMS, Update247, Uplisting

### V-Z
Vesta, Virtual Resort Manager (VRM), VRBookings, Vreasy, WebReady, WooDoo, Yield Planet, YnnovBooking, Your.Rentals, Zak by WuBook, Zeevou, ZenHost

---

## Integration Categories

| Category | Count | Examples |
|----------|-------|---------|
| Short-Term Rentals | 117 | Guesty, Hostaway, Lodgify, Hospitable |
| Hotels | 65 | Cloudbeds, Mews, RoomRaccoon, Apaleo |
| RV/Campgrounds | 7 | newbook, RMS |
| Hostels | 2 | -- |
| Other | 3 | -- |

Note: Some PMS systems serve multiple categories.

---

## Channel Manager Integrations

- Rentals United
- Channex
- AdvanceCM
- Bookandlink
- HostHub
- OTA Sync
- RoomCloud
- STAAH
- Update247
- Yield Planet
- WooDoo
- Booking Automation
- Maxxton

---

## Notable Integration Details

### Guesty
- Only one PriceLabs account per Guesty account
- API key valid for only 4 hours during setup
- Full feature support

### Hostaway
- Cannot use both Hostaway Dynamic Pricing AND PriceLabs simultaneously
- Must choose one or the other

### OwnerRez
- Gap night rules between PriceLabs and OwnerRez are incompatible
- Must configure gap rules in one system only

### Booking Automation
- Prices sent daily

### Smoobu
- Full integration support
- Prices and min-stay rules sync

### MotoPress (WordPress)
- Native PriceLabs integration
- Updates prices automatically 2x/day
- Best option for WordPress direct booking sites

---

## Best Practice: PMS-as-Hub Architecture

The recommended setup:
```
PriceLabs → Your PMS → All OTAs (Airbnb, Vrbo, Booking.com, etc.)
```

Configure PriceLabs to sync with your PMS as the central hub. The PMS then distributes pricing to all connected channels automatically. This avoids conflicts between multiple pricing sources.

---

## Integration Limitations

| Limitation | Details |
|------------|---------|
| Geographic restrictions | Not available in Iran, North Korea, Cuba, Syria |
| Pricing window | 540 days default, 720 max |
| Sync frequency | Default 1x/day (not real-time) |
| Baseline rate required | Must exist before first PriceLabs sync |
| 10-minute buffer | After config changes before pushing |
| Booking.com | No availability sync (iCal needed) |
| iCal delay | Hours, not real-time |
| Listing Optimizer | Airbnb only |
| Market Dashboard data | Airbnb, Vrbo, KeyData only |

---

## Sources
- [PriceLabs Integrations Page](https://hello.pricelabs.co/integrations/)
- [PriceLabs 161 PMS Milestone](https://www.thehostreport.com/news/pricelabs-hits-161-pms-integrations)
- [Hostaway Integration](https://hello.pricelabs.co/integration/hostaway/)
- [Guesty Integration](https://hello.pricelabs.co/integration/guesty/)
- [Airbnb Integration](https://hello.pricelabs.co/pricelabs-official-airbnb-software-partner/)
- [Booking.com Integration](https://hello.pricelabs.co/pricelabs-launches-official-booking-com-integration/)
- [Open API Launch](https://hello.pricelabs.co/pricelabs-launches-open-api/)
- [Customer API for WordPress](https://help.pricelabs.co/portal/en/kb/articles/how-to-use-pricelabs-customer-api-to-send-the-prices-to-wordpress-wix-website)
