// Comprehensive dictionary for top Indian equities, indices, commodities, and multilingual terms
const SYMBOL_DICTIONARY = {
  // Indices
  'NIFTY': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'NIFTY 50': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'NIFTY50': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  '^NSEI': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'निफ्टी': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'નિફ્ટી': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },

  'SENSEX': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'BSE SENSEX': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  '^BSESN': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'सेंसेक्स': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'સેન્સેક્સ': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },

  'BANK NIFTY': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'BANKNIFTY': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'NIFTYBANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'NIFTY BANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  '^NSEBANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'बैंक निफ्टी': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'બેંક નિફ્ટી': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },

  // Commodities
  'GOLD': { symbol: 'GC=F', name: 'Gold (international)', type: 'COMMODITY', currency: 'USD' },
  'GOLD 24K': { symbol: 'GC=F', name: 'Gold (international)', type: 'COMMODITY', currency: 'USD' },
  'GC=F': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },
  'सोना': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },
  'સોનું': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },

  'CRUDE': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'CRUDE OIL': { symbol: 'CL=F', name: 'Crude Oil (WTI)', type: 'COMMODITY', currency: 'USD' },
  'CRUDEOIL': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'OIL': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'CL=F': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'कच्चा तेल': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'ક્રૂડ ઓઇલ': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },

  'USD/INR': { symbol: 'USDINR=X', name: 'USD / INR', type: 'CURRENCY', currency: 'INR' },
  'USDINR': { symbol: 'USDINR=X', name: 'USD / INR', type: 'CURRENCY', currency: 'INR' },

  // Indian Equities (Top High-Volume / Requested)
  'IOC': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'IOCL': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'INDIAN OIL': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'INDIAN OIL CORPORATION': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'IOC.NS': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'आईओसी': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },

  'JIOFIN': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FINANCIAL': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FINANCIAL SERVICES': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FIN': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIOFIN.NS': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'जियो फाइनेंस': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'જિયો ફાઇનાન્સ': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },

  'RELIANCE': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RELIANCE INDUSTRIES': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RIL': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RELIANCE.NS': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'रिलायंस': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'રિલાયન્સ': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },

  'TCS': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TATA CONSULTANCY': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TATA CONSULTANCY SERVICES': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TCS.NS': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'टीसीएस': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },

  'TATAMOTORS': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'TATA MOTORS': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'टाटा मोटर्स': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'ટાટા મોટર્સ': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },

  'TATASTEEL': { symbol: 'TATASTEEL.NS', name: 'Tata Steel', type: 'EQUITY' },
  'TATA STEEL': { symbol: 'TATASTEEL.NS', name: 'Tata Steel', type: 'EQUITY' },

  'INFY': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'INFOSYS': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'INFOSYS LIMITED': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'इंफोसिस': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },

  'HDFCBANK': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'HDFC BANK': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'HDFC': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'एचडीएफसी बैंक': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },

  'ICICIBANK': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },
  'ICICI BANK': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },
  'ICICI': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },

  'SBIN': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'SBI': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'STATE BANK OF INDIA': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'एसबीआई': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },

  'ITC': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },
  'ITC LIMITED': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },
  'आईटीसी': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },

  'ADANIENT': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },
  'ADANI ENTERPRISES': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },
  'अदाणी एंटरप्राइजेज': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },

  'ADANIPORTS': { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', type: 'EQUITY' },
  'ADANI PORTS': { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', type: 'EQUITY' },

  'LT': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },
  'L&T': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },
  'LARSEN & TOUBRO': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },

  'AXISBANK': { symbol: 'AXISBANK.NS', name: 'Axis Bank', type: 'EQUITY' },
  'AXIS BANK': { symbol: 'AXISBANK.NS', name: 'Axis Bank', type: 'EQUITY' },

  'HINDUNILVR': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },
  'HUL': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },
  'HINDUSTAN UNILEVER': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },

  // Defense, PSU & Emerging Bluechips
  'BEL': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'BEL.NS': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'BHARAT ELECTRONICS': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'बीईएल': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'બીઈએલ': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },

  'HAL': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },
  'HAL.NS': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },
  'HINDUSTAN AERONAUTICS': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },

  'ZOMATO': { symbol: 'ZOMATO.NS', name: 'Zomato Limited', type: 'EQUITY' },
  'ZOMATO.NS': { symbol: 'ZOMATO.NS', name: 'Zomato Limited', type: 'EQUITY' },

  'IRFC': { symbol: 'IRFC.NS', name: 'Indian Railway Finance Corporation', type: 'EQUITY' },
  'IRFC.NS': { symbol: 'IRFC.NS', name: 'Indian Railway Finance Corporation', type: 'EQUITY' },

  'VEDL': { symbol: 'VEDL.NS', name: 'Vedanta Limited', type: 'EQUITY' },
  'VEDANTA': { symbol: 'VEDL.NS', name: 'Vedanta Limited', type: 'EQUITY' },

  'TITAN': { symbol: 'TITAN.NS', name: 'Titan Company', type: 'EQUITY' },
  'TITAN.NS': { symbol: 'TITAN.NS', name: 'Titan Company', type: 'EQUITY' },

  'COALINDIA': { symbol: 'COALINDIA.NS', name: 'Coal India Limited', type: 'EQUITY' },
  'COAL INDIA': { symbol: 'COALINDIA.NS', name: 'Coal India Limited', type: 'EQUITY' },

  'NTPC': { symbol: 'NTPC.NS', name: 'NTPC Limited', type: 'EQUITY' },
  'POWERGRID': { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation', type: 'EQUITY' },
  'ONGC': { symbol: 'ONGC.NS', name: 'Oil and Natural Gas Corporation', type: 'EQUITY' },


  'BHARTIARTL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },
  'AIRTEL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },
  'BHARTI AIRTEL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },

  'SUNPHARMA': { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', type: 'EQUITY' },
  'SUN PHARMA': { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', type: 'EQUITY' },

  'MARUTI': { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', type: 'EQUITY' },
  'MARUTI SUZUKI': { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', type: 'EQUITY' },

  'M&M': { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', type: 'EQUITY' },
  'MAHINDRA': { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', type: 'EQUITY' },

  'WIPRO': { symbol: 'WIPRO.NS', name: 'Wipro Limited', type: 'EQUITY' },
  'BAJFINANCE': { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', type: 'EQUITY' },
  'BAJAJ FINANCE': { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', type: 'EQUITY' },
  'KOTAKBANK': { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', type: 'EQUITY' },
  'KOTAK BANK': { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', type: 'EQUITY' },

  // Deccan Gold Mines & Precious Metal / Jewelry Equities
  'DECNGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECNGOLD.NS': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECNGOLD.BO': { symbol: 'DECNGOLD.BO', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCANGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECANGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD MINES': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD MINES LIMITED': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'डेक्कन गोल्ड': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'ડેક્કન ગોલ્ડ': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },

  'GOLDBEES': { symbol: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', type: 'EQUITY', currency: 'INR' },
  'GOLD BEES': { symbol: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', type: 'EQUITY', currency: 'INR' },
  'GOLDIAM': { symbol: 'GOLDIAM.NS', name: 'Goldiam International Limited', type: 'EQUITY', currency: 'INR' },
  'GOLDTECH': { symbol: 'GOLDTECH.NS', name: 'Goldstone Technologies Limited', type: 'EQUITY', currency: 'INR' },
  'MUTHOOTFIN': { symbol: 'MUTHOOTFIN.NS', name: 'Muthoot Finance Limited', type: 'EQUITY', currency: 'INR' },
  'MUTHOOT FINANCE': { symbol: 'MUTHOOTFIN.NS', name: 'Muthoot Finance Limited', type: 'EQUITY', currency: 'INR' },
  'KALYANKJIL': { symbol: 'KALYANKJIL.NS', name: 'Kalyan Jewellers India Limited', type: 'EQUITY', currency: 'INR' },
  'KALYAN JEWELLERS': { symbol: 'KALYANKJIL.NS', name: 'Kalyan Jewellers India Limited', type: 'EQUITY', currency: 'INR' },
};

module.exports = { SYMBOL_DICTIONARY };
