import './app.css';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, BookOpen, ChartNoAxesCombined, Check, ChevronRight, ClipboardList,
  Clock3, Coins, FileClock, Home, LogIn, LogOut, Menu, Moon, Plus, Printer,
  Search, ShoppingCart, Sparkles, Sun, SunMedium, UserRound, Wallet, X,
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setAuthTokenGetter } from './api/client';
import * as booksAPI from './api/books';
import * as billsAPI from './api/bills';

// Frontend types matching backend
type Book = {
  id: number;
  name: string;
  language: string;
  mrp: number;
  actualPrice: number;
  stock: number;
  minStock: number;
  createdAt?: string;
  updatedAt?: string;
};
// Legacy type alias for backward compatibility with existing UI logic
type LegacyBook = { id: number; n: string; l: string; m: number; p: number; s: number; min: number };

type DiscountMode = 'amount' | 'percentage';
type Bill = {
  no: number; c: string; d: string; tm: string; pay: 'Cash' | 'Online';
  it: [number, number][]; st: string; discount: number;
  discountMode: DiscountMode; discountInput: number;
};
type Screen = 'home' | 'books' | 'sale' | 'history' | 'receipt' | 'reports' | 'stock' | 'more' | 'account';
type Report = 'Summary' | 'Book-wise' | 'Language-wise' | 'Payment-wise';

// Helper to convert API Book to legacy format for existing UI logic
const toLegacy = (book: Book): LegacyBook => ({
  id: book.id,
  n: book.name,
  l: book.language,
  m: book.mrp,
  p: book.actualPrice,
  s: book.stock,
  min: book.minStock,
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const dateKeyDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return localDateKey(date);
};

const initialBills: Bill[] = [];

const navItems: { key: Screen; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'books', label: 'Books', icon: BookOpen },
  { key: 'sale', label: 'Sales', icon: ShoppingCart },
  { key: 'history', label: 'History', icon: FileClock },
  { key: 'reports', label: 'Reports', icon: ChartNoAxesCombined },
  { key: 'stock', label: 'Stock', icon: ClipboardList },
  { key: 'more', label: 'More', icon: Menu },
  { key: 'account', label: 'Account', icon: UserRound },
];

const languageName = (language: string) => language;
const format = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const subtotal = (bill: Bill, books: LegacyBook[]) => bill.it.reduce((sum, [id, q]) => sum + (books.find(b => b.id === id)?.p || 0) * q, 0);
const total = (bill: Bill, books: LegacyBook[]) => Math.max(0, subtotal(bill, books) - bill.discount);
const mrp = (bill: Bill, books: LegacyBook[]) => bill.it.reduce((sum, [id, q]) => sum + (books.find(b => b.id === id)?.m || 0) * q, 0);
const quantity = (bill: Bill) => bill.it.reduce((sum, [, q]) => sum + q, 0);
const shortDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function Metric({ label, value, tone = '', testId }: { label: string; value: string | number; tone?: string; testId: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const match = String(value).match(/^(₹?)([\d,]+)(.*)$/);
    if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const prefix = match[1]; const suffix = match[3]; const target = Number(match[2].replaceAll(',', ''));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const n = Math.round(target * (1 - Math.pow(1 - t, 3)));
      setShown(`${prefix}${n.toLocaleString('en-IN')}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <div className={`metric ${tone}`} data-testid={`metric-${testId}`}><small>{label}</small><b>{shown}</b></div>;
}

function LotusMark({ className = '', width = '68', height = '46' }: { className?: string; width?: string; height?: string }) {
  return <svg className={className} width={width} height={height} viewBox="0 0 100 52" aria-hidden="true">
    <g fill="#f9c4d4" stroke="#e58aa6" strokeWidth="1.5">
      <ellipse cx="50" cy="28" rx="10" ry="22" transform="rotate(-68 50 48)" />
      <ellipse cx="50" cy="28" rx="10" ry="22" transform="rotate(68 50 48)" />
      <ellipse cx="50" cy="28" rx="10" ry="22" transform="rotate(-36 50 48)" />
      <ellipse cx="50" cy="28" rx="10" ry="22" transform="rotate(36 50 48)" />
      <ellipse cx="50" cy="26" rx="10" ry="23" fill="#fbd6e0" />
    </g>
  </svg>;
}

function Dashboard() {
  const [screen, setScreen] = useState<Screen>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [bills, setBills] = useState(initialBills);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [payment, setPayment] = useState<'Online' | 'Cash'>('Online');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
  const [discountInput, setDiscountInput] = useState('');
  const [customer, setCustomer] = useState('');
  const [mobile, setMobile] = useState('');
  const [last, setLast] = useState<Bill | null>(null);
  const [receiptAutoReturn, setReceiptAutoReturn] = useState(false);
  const [language, setLanguage] = useState('All');
  const [bookSearch, setBookSearch] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [report, setReport] = useState<Report>('Summary');
  const [from, setFrom] = useState(() => dateKeyDaysAgo(6));
  const [to, setTo] = useState(() => dateKeyDaysAgo(0));
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('bhaktivedanta-theme') === 'dark'; }
    catch { return false; }
  });
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  // Load books from API on mount
  useEffect(() => {
    loadBooks();
    loadBills();
  }, []);

  const loadBooks = async () => {
    setBooksLoading(true);
    setBooksError(null);
    try {
      const data = await booksAPI.getBooks();
      setBooks(data);
      
      // Clear cart when books are reloaded to prevent stale book IDs
      // This ensures cart always references valid, current book IDs from database
      setCart({});
    } catch (error) {
      console.error("Failed to load books:", error);
      setBooksError(error instanceof Error ? error.message : "Failed to load books");
      notify("Failed to load books. Please refresh the page.");
    } finally {
      setBooksLoading(false);
    }
  };

  const loadBills = async () => {
    try {
      const data = await billsAPI.getBills();
      // Convert backend bills to frontend format
      const convertedBills = data.map(bill => ({
        no: parseInt(bill.billNumber),
        c: bill.customerName,
        d: bill.date,
        tm: bill.time,
        pay: bill.paymentMethod,
        it: bill.items?.map(item => [item.bookId, item.quantity] as [number, number]) || [],
        st: bill.staffName,
        discount: bill.discountAmount,
        discountMode: (bill.discountMode === 'percent' ? 'percentage' : 'amount') as DiscountMode,
        discountInput: parseFloat(bill.discountInput || '0'),
      }));
      setBills(convertedBills);
    } catch (error) {
      console.error("Failed to load bills:", error);
      // Don't show error notification for bills - they're optional
    }
  };

  // Convert books to legacy format for existing UI logic
  const legacyBooks = useMemo(() => books.map(toLegacy), [books]);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 1900);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (screen !== 'receipt' || !last || !receiptAutoReturn) return;
    const timeout = window.setTimeout(() => {
      setReceiptAutoReturn(false);
      setHistory(stack => stack.slice(0, -1));
      setScreen('sale');
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [screen, last, receiptAutoReturn]);
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.content .section-title, .content .metric-grid, .content .actions-grid, .content .panel, .content .two-col > section'));
    elements.forEach((element, index) => {
      element.classList.add('scroll-reveal');
      element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 45}ms`);
    });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [screen]);

  const navigate = (next: Screen) => {
    if (next === screen) { setMobileMenu(false); return; }
    setHistory(stack => [...stack, screen]);
    setScreen(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const goBack = () => {
    const previous = history[history.length - 1] || 'home';
    setHistory(stack => stack.slice(0, -1));
    setReceiptAutoReturn(false);
    setScreen(previous);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const notify = (message: string) => setToast(message);
  const openReceipt = (bill: Bill) => { setReceiptAutoReturn(false); setLast(bill); navigate('receipt'); };

  const addToCart = (id: number) => {
    const book = legacyBooks.find(b => b.id === id);
    if (!book?.s) { notify('This title is out of stock.'); return; }
    setCart(current => ({ ...current, [id]: Math.min((current[id] || 0) + 1, book.s) }));
  };
  const changeQuantity = (id: number, delta: number) => {
    const book = legacyBooks.find(b => b.id === id);
    setCart(current => {
      const next = { ...current }; const value = (next[id] || 0) + delta;
      if (value <= 0) delete next[id];
      else if (book && value > book.s) { next[id] = book.s; notify('Only this many copies are in stock.'); }
      else next[id] = value;
      return next;
    });
  };
  const enteredDiscount = Math.max(0, Number(discountInput) || 0);
  const cartIds = Object.keys(cart).map(Number);
  const cartMrp = cartIds.reduce((sum, id) => sum + (legacyBooks.find(b => b.id === id)?.m || 0) * cart[id], 0);
  const cartTotal = cartIds.reduce((sum, id) => sum + (legacyBooks.find(b => b.id === id)?.p || 0) * cart[id], 0);
  const discountAmount = Math.min(cartTotal, discountMode === 'percentage'
    ? Math.round(cartTotal * Math.min(enteredDiscount, 100) / 100)
    : Math.round(enteredDiscount));
  const amountDue = Math.max(0, cartTotal - discountAmount);

  const makeBill = async () => {
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => [Number(id), q] as [number, number]);
    if (!items.length) { notify('Choose a book before creating a bill.'); return; }
    if (!customer.trim()) { notify('Enter the customer name.'); return; }
    
    // Validate all cart items reference existing books with sufficient stock
    const invalidItems: string[] = [];
    const validatedItems = items.filter(([bookId, quantity]) => {
      const book = books.find(b => b.id === bookId);
      if (!book) {
        invalidItems.push(`Book ID ${bookId} no longer exists`);
        return false;
      }
      if (book.stock < quantity) {
        invalidItems.push(`${book.name}: only ${book.stock} available, requested ${quantity}`);
        return false;
      }
      return true;
    });
    
    if (invalidItems.length > 0) {
      notify(`Cannot create bill: ${invalidItems.join(', ')}`);
      // Remove invalid items from cart
      setCart(current => {
        const cleaned = { ...current };
        items.forEach(([id]) => {
          if (!books.find(b => b.id === id)) {
            delete cleaned[id];
          }
        });
        return cleaned;
      });
      return;
    }
    
    try {
      // Create bill in backend (also updates stock automatically)
      const billData: billsAPI.CreateBillData = {
        customerName: customer.trim(),
        customerMobile: mobile.trim() || undefined,
        paymentMethod: payment,
        staffName: "Staff",
        discountAmount: discountAmount,
        discountMode: discountMode === 'percentage' ? 'percent' : 'amount',
        discountInput: enteredDiscount.toString(),
        items: validatedItems.map(([bookId, quantity]) => {
          const book = books.find(b => b.id === bookId)!;
          return {
            bookId,
            quantity,
            priceAtSale: book.actualPrice,
          };
        }),
      };
      
      const createdBill = await billsAPI.createBill(billData);
      
      // Reload books to get updated stock from backend
      await loadBooks();
      
      // Convert backend bill to frontend format
      const bill: Bill = {
        no: parseInt(createdBill.billNumber),
        c: createdBill.customerName,
        d: createdBill.date,
        tm: createdBill.time,
        pay: createdBill.paymentMethod,
        it: items,
        st: createdBill.staffName,
        discount: createdBill.discountAmount,
        discountMode: discountMode,
        discountInput: enteredDiscount,
      };
      
      setBills(current => [...current, bill]);
      setLast(bill); setReceiptAutoReturn(true); setCart({}); setCustomer(''); setMobile('');
      setDiscountInput(''); setDiscountMode('amount'); navigate('receipt');
      notify('Sale completed successfully.');
    } catch (error) {
      console.error('Failed to create bill:', error);
      notify('Failed to complete sale. Please try again.');
    }
  };
  
  const addBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const lang = String(data.get('language') || '').trim();
    const startingStock = Number(data.get('stock')) || 0;
    const listed = Number(data.get('mrp')); 
    const actual = Number(data.get('actual'));
    
    if (!name || !lang || !listed || !actual) { 
      notify('Enter the title, language, MRP and actual price.'); 
      return; 
    }

    try {
      const newBook = await booksAPI.createBook({
        name,
        language: lang,
        mrp: listed,
        actualPrice: actual,
        stock: startingStock,
        minStock: 10,
      });
      
      setBooks(current => [...current, newBook]);
      event.currentTarget?.reset(); 
      notify('Book added successfully.');
    } catch (error) {
      console.error('Failed to add book:', error);
      notify('Failed to add book. Please try again.');
    }
  };

  const filteredBills = useMemo(() => bills.filter(bill => bill.d >= from && bill.d <= to), [bills, from, to]);
  const reportLines = useMemo(() => {
    if (report === 'Summary') return [];
    const groups = new Map<string, { q: number; revenue: number }>();
    filteredBills.forEach(bill => {
      const billSubtotal = subtotal(bill, legacyBooks);
      bill.it.forEach(([id, q]) => {
        const book = legacyBooks.find(b => b.id === id); if (!book) return;
        const label = report === 'Book-wise' ? `${book.n} (${languageName(book.l)})` : report === 'Language-wise' ? languageName(book.l) : bill.pay;
        const item = groups.get(label) || { q: 0, revenue: 0 };
        const lineSubtotal = q * book.p;
        item.q += q;
        item.revenue += lineSubtotal - (billSubtotal ? bill.discount * lineSubtotal / billSubtotal : 0);
        groups.set(label, item);
      });
    });
    return [...groups.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [legacyBooks, filteredBills, report]);
  const matchesBookSearch = (book: LegacyBook, query: string) => `${book.n} ${languageName(book.l)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filteredBooks = legacyBooks.filter(book => (language === 'All' || languageName(book.l) === language) && matchesBookSearch(book, bookSearch));
  const saleBooks = legacyBooks.filter(book => matchesBookSearch(book, saleSearch));
  const searchedBills = [...bills].sort((a, b) => b.no - a.no).filter(bill =>
    `${bill.no} ${bill.c} ${bill.pay} ${bill.d} ${bill.tm}`.toLocaleLowerCase().includes(historySearch.trim().toLocaleLowerCase()));
  const lowBooks = legacyBooks.filter(book => book.s <= book.min);
  const todayBills = bills.filter(bill => bill.d === localDateKey());
  const reportRevenue = filteredBills.reduce((sum, bill) => sum + total(bill, legacyBooks), 0);
  const reportDiscount = filteredBills.reduce((sum, bill) => sum + bill.discount, 0);
  const reportQuantity = filteredBills.reduce((sum, bill) => sum + quantity(bill), 0);
  const reportLabel = report === 'Book-wise' ? 'Book' : report === 'Language-wise' ? 'Language' : 'Payment';

  const title: Record<Screen, string> = {
    home: 'Home', books: 'Books', sale: 'Sales', history: 'History', receipt: 'Receipt',
    reports: 'Reports', stock: 'Stock', more: 'More', account: 'Account',
  };
  const pageTitle: Record<Screen, string> = {
    home: 'Home', books: 'Books', sale: 'New sale', history: 'Bill history', receipt: 'Receipt',
    reports: 'Reports', stock: 'Stock status', more: 'More', account: 'Account',
  };
  const navKey = screen;
  const bookById = (id: number) => books.find(book => book.id === id);
  const badge = (text: string, tone: string) => <span className={`badge ${tone}`}>{text}</span>;
  const stockBadge = (book: Book | LegacyBook) => {
    const stock = 'stock' in book ? book.stock : book.s;
    const minStock = 'minStock' in book ? book.minStock : book.min;
    return stock === 0 ? badge('Out of stock', 'rd') : stock <= minStock ? badge('Low', 'am') : badge('In stock', 'gr');
  };
  const PageHead = ({ heading, sub }: { heading: string; sub?: string }) => (
    <div className="page-head">
      <div className="page-heading-row">
        {screen !== 'home' && <button className="back-control" data-testid="button-back" aria-label={`Back to ${title[history[history.length - 1] || 'home']}`} onClick={goBack}><ArrowLeft size={17} /><span>Back</span></button>}
        <div><h1>{heading}</h1>{sub && <p>{sub}</p>}</div>
      </div>
    </div>
  );
  const PanelRow = ({ children, right, onClick, tap = false, testId }: {
    children: ReactNode; right?: ReactNode; onClick?: () => void; tap?: boolean; testId?: string;
  }) => <div
    className={`row ${tap ? 'tap' : ''}`}
    onClick={onClick}
    onKeyDown={tap && onClick ? event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
    } : undefined}
    role={tap ? 'button' : undefined}
    tabIndex={tap ? 0 : undefined}
    data-testid={testId}
  >{children}{right && <div className="row-right">{right}</div>}</div>;
  const toggleTheme = () => setDark(value => {
    const next = !value;
    try { localStorage.setItem('bhaktivedanta-theme', next ? 'dark' : 'light'); } catch { /* Storage can be unavailable in private mode. */ }
    return next;
  });
  const currentDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  const hero = <>
    <section className="hero" data-testid="dashboard-hero">
      <div className="hero-date">{currentDate}</div>
      <h1>Bhaktivedanta Book Stall</h1>
      <p className="hero-greeting"><span>Hare Krishna</span><span className="hero-location"><span className="peacock" role="img" aria-label="peacock">🦚</span> ISKCON Pandharpur</span></p>
      <div className="hero-orbit" aria-hidden="true" /><LotusMark className="hero-lotus" />
    </section>
    <div className="marquee" aria-label="Radha — Krishna"><span>{'Radha — Krishna  🪈　·　'.repeat(18)}</span></div>
  </>;

  const page = () => {
    if (screen === 'home') return <>
      {hero}
      <h2 className="section-title">Today at the stall</h2>
      <div className="metric-grid stagger">
        <Metric label="Today's sales" value={format(todayBills.reduce((sum, bill) => sum + total(bill, legacyBooks), 0))} tone="gr" testId="today-sales" />
        <Metric label="Books sold" value={todayBills.reduce((sum, bill) => sum + quantity(bill), 0)} tone="bl" testId="books-sold" />
        <Metric label="Online" value={format(todayBills.filter(bill => bill.pay === 'Online').reduce((sum, bill) => sum + total(bill, legacyBooks), 0))} testId="online-sales" />
        <Metric label="Cash" value={format(todayBills.filter(bill => bill.pay === 'Cash').reduce((sum, bill) => sum + total(bill, legacyBooks), 0))} testId="cash-sales" />
        <Metric label="Bills" value={todayBills.length} testId="bill-count" />
        <Metric label="Owner-set discounts" value={format(todayBills.reduce((sum, bill) => sum + bill.discount, 0))} testId="discount-total" />
      </div>
      <h2 className="section-title">Quick actions</h2>
      <div className="actions-grid">
        <button className="btn" data-testid="button-new-sale" onClick={() => navigate('sale')}><Plus size={17} /> New sale</button>
        <button className="btn outline" data-testid="button-stock-status" onClick={() => navigate('stock')}>Stock status · {lowBooks.length} low</button>
        <button className="btn outline" data-testid="button-view-reports" onClick={() => navigate('reports')}>View reports</button>
      </div>
      <h2 className="section-title">Recent sales</h2>
      <div className="panel stagger" data-testid="list-recent-sales">
        {[...bills].sort((a, b) => b.no - a.no).slice(0, 5).map(bill =>
          <PanelRow key={bill.no} tap testId={`row-recent-bill-${bill.no}`} onClick={() => openReceipt(bill)} right={<><b>{format(total(bill, legacyBooks))}</b><br />{badge(bill.pay, bill.pay === 'Online' ? 'bl' : 'gr')}</>}>
            <span>Bill #{bill.no} · {bill.c}<small>{bill.tm} · {quantity(bill)} books</small></span>
          </PanelRow>)}
      </div>
    </>;

    if (screen === 'books') return <>
      <PageHead heading="Books" sub="Inventory, prices and language availability" />
      {booksLoading ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: 'var(--mute)' }}>
          Loading books...
        </div>
      ) : booksError ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', marginBottom: 16 }}>{booksError}</div>
          <button className="btn" onClick={loadBooks}>Retry</button>
        </div>
      ) : (
        <>
          <div className="search-field">
            <Search size={18} aria-hidden="true" />
            <input data-testid="input-book-search" aria-label="Search books" value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search title or language…" />
            {bookSearch && <button type="button" data-testid="button-clear-book-search" aria-label="Clear book search" onClick={() => setBookSearch('')}><X size={16} /></button>}
          </div>
          <div className="chips" aria-label="Filter books by language">{['All', ...new Set(legacyBooks.map(book => languageName(book.l)))].map(lang =>
            <button key={lang} data-testid={`filter-language-${lang.toLowerCase()}`} className={`chip ${language === lang ? 'on' : ''}`} onClick={() => setLanguage(lang)}>{lang}</button>)}</div>
          <div className="panel stagger" data-testid="list-books">
            {filteredBooks.map(book => <PanelRow key={book.id} testId={`row-book-${book.id}`} right={<><b>{book.s}</b><br />{stockBadge(book)}</>}>
              <span>{book.n}<small>{languageName(book.l)} · MRP {format(book.m)} · Actual {format(book.p)}</small></span>
            </PanelRow>)}
            {!filteredBooks.length && <div className="empty" data-testid="empty-books">{books.length === 0 ? 'No books in inventory yet. Add your first book below.' : 'No books match your search. Try another title or language.'}</div>}
          </div>
          <h2 className="section-title">Add a book</h2>
          <form className="panel" style={{ padding: 20 }} onSubmit={addBook} data-testid="form-add-book">
            <div className="input-grid">
              <div style={{ gridColumn: '1/-1' }}><label htmlFor="book-name">Book title</label><input id="book-name" data-testid="input-book-name" name="name" required /></div>
              <div><label htmlFor="book-language">Language</label><input id="book-language" data-testid="input-book-language" name="language" placeholder="Marathi" required /></div>
              <div><label htmlFor="book-stock">Opening stock</label><input id="book-stock" data-testid="input-book-stock" name="stock" type="number" min="0" defaultValue="0" /></div>
              <div><label htmlFor="book-mrp">MRP</label><input id="book-mrp" data-testid="input-book-mrp" name="mrp" type="number" min="0" required /></div>
              <div><label htmlFor="book-price">Actual price</label><input id="book-price" data-testid="input-book-price" name="actual" type="number" min="0" required /></div>
            </div>
            <button className="btn full" style={{ marginTop: 16 }} data-testid="button-save-book" type="submit">Save book</button>
          </form>
        </>
      )}
    </>;

    if (screen === 'sale') return <>
      <PageHead heading="New sale" sub="Build a bill with the books the customer chooses" />
      <div className="two-col">
        <section>
          <h2 className="section-title" style={{ marginTop: 0 }}>Choose books</h2>
          <div className="search-field sale-search">
            <Search size={18} aria-hidden="true" />
            <input data-testid="input-sale-book-search" aria-label="Search books for this sale" value={saleSearch} onChange={e => setSaleSearch(e.target.value)} placeholder="Search books…" />
            {saleSearch && <button type="button" data-testid="button-clear-sale-search" aria-label="Clear sale book search" onClick={() => setSaleSearch('')}><X size={16} /></button>}
          </div>
          <div className="panel stagger" data-testid="list-sale-books">
            {saleBooks.map(book => <PanelRow key={book.id} tap testId={`button-add-book-${book.id}`} onClick={() => addToCart(book.id)} right={<><b>{format(book.p)}</b><small>Actual price</small></>}>
              <span>{book.n}<small>{languageName(book.l)} · Stock {book.s}</small></span>
            </PanelRow>)}
            {!saleBooks.length && <div className="empty" data-testid="empty-sale-search">No books match your search.</div>}
          </div>
          <h2 className="section-title">Selected books</h2>
          <div className="panel" data-testid="list-sale-cart">{cartIds.length ? cartIds.map(id => {
            const book = bookById(id); if (!book) return null;
            return <PanelRow key={id} testId={`row-cart-book-${id}`} right={<div className="quantity">
              <button aria-label={`Remove one ${book.name}`} data-testid={`button-decrease-quantity-${id}`} onClick={() => changeQuantity(id, -1)}>−</button>
              <span data-testid={`text-quantity-${id}`}>{cart[id]}</span>
              <button aria-label={`Add one ${book.name}`} data-testid={`button-increase-quantity-${id}`} onClick={() => changeQuantity(id, 1)}>+</button>
            </div>}>
              <span>{book.name} ({languageName(book.language)})<small>Actual {format(book.actualPrice)}</small></span>
            </PanelRow>;
          }) : <div className="empty" data-testid="empty-sale-cart">Choose a book above to start this bill.</div>}</div>
        </section>
        <section>
          <h2 className="section-title" style={{ marginTop: 0 }}>Customer details</h2>
          <div className="input-grid">
            <div><label htmlFor="sale-customer">Name</label><input id="sale-customer" data-testid="input-customer-name" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" /></div>
            <div><label htmlFor="sale-mobile">Mobile number</label><input id="sale-mobile" data-testid="input-customer-mobile" value={mobile} onChange={e => setMobile(e.target.value)} inputMode="numeric" placeholder="98XXXXXX10" /></div>
          </div>
          <h2 className="section-title">Payment</h2>
          <div className="actions-grid payment-options" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className={`btn ${payment !== 'Online' ? 'outline' : ''}`} data-testid="button-payment-online" aria-pressed={payment === 'Online'} onClick={() => setPayment('Online')}><Wallet size={16} />Online (UPI)</button>
            <button className={`btn ${payment !== 'Cash' ? 'outline' : ''}`} data-testid="button-payment-cash" aria-pressed={payment === 'Cash'} onClick={() => setPayment('Cash')}><Coins size={16} />Cash</button>
          </div>
          <div className="discount-editor">
            <div className="discount-heading"><span>Discount</span><small>Set by owner</small></div>
            <div className="discount-options">
              <div className="discount-switch" role="group" aria-label="Discount type">
                <button type="button" data-testid="button-discount-amount" className={discountMode === 'amount' ? 'active' : ''} aria-pressed={discountMode === 'amount'} onClick={() => setDiscountMode('amount')}>Amount ₹</button>
                <button type="button" data-testid="button-discount-percent" className={discountMode === 'percentage' ? 'active' : ''} aria-pressed={discountMode === 'percentage'} onClick={() => setDiscountMode('percentage')}>Percent %</button>
              </div>
              <label className="discount-input"><span>{discountMode === 'amount' ? '₹' : '%'}</span><input
                data-testid="input-manual-discount" aria-label={discountMode === 'amount' ? 'Owner-set discount amount' : 'Owner-set discount percentage'}
                type="number" min="0" max={discountMode === 'percentage' ? 100 : cartTotal}
                step={discountMode === 'amount' ? 1 : 0.01} value={discountInput}
                onChange={e => setDiscountInput(e.target.value)} placeholder="0" /></label>
            </div>
          </div>
          <div className="summary-box" style={{ marginTop: 18 }} data-testid="summary-sale-total">
            <div><span>MRP total</span><span>{format(cartMrp)}</span></div>
            <div><span>Actual total</span><span>{format(cartTotal)}</span></div>
            <div className="manual-discount"><span>Owner-set discount</span><span>− {format(discountAmount)}</span></div>
            <div className="total"><span>Amount due</span><span data-testid="text-sale-amount-due">{format(amountDue)}</span></div>
          </div>
          <button className="btn full" style={{ marginTop: 13 }} data-testid="button-create-bill" onClick={makeBill}>Create bill</button>
        </section>
      </div>
    </>;

    if (screen === 'history') return <>
      <PageHead heading="Bill history" sub="Find a previous bill and open its receipt" />
      <div className="search-field">
        <Search size={18} aria-hidden="true" />
        <input data-testid="input-history-search" aria-label="Search bill history" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search bill number, customer, payment or date…" />
        {historySearch && <button type="button" data-testid="button-clear-history-search" aria-label="Clear history search" onClick={() => setHistorySearch('')}><X size={16} /></button>}
      </div>
      <div className="history-summary"><span>{searchedBills.length} {searchedBills.length === 1 ? 'bill' : 'bills'}</span><span>Newest first</span></div>
      <div className="panel stagger" data-testid="list-bill-history">
        {searchedBills.map(bill => <PanelRow key={bill.no} tap testId={`row-history-bill-${bill.no}`} onClick={() => openReceipt(bill)} right={<><b>{format(total(bill, legacyBooks))}</b><br />{badge(bill.pay, bill.pay === 'Online' ? 'bl' : 'gr')}</>}>
          <span>Bill #{bill.no} · {bill.c}<small>{shortDate(bill.d)} · {bill.tm} · {quantity(bill)} books</small></span>
        </PanelRow>)}
        {!searchedBills.length && <div className="empty" data-testid="empty-bill-history">No bills match this search. Try a name, bill number, payment type or date.</div>}
      </div>
    </>;

    if (screen === 'receipt') {
      if (!last) return <><PageHead heading="Receipt" /><div className="panel empty">Choose a bill from History or Recent sales to view its receipt.</div><button className="btn" style={{ marginTop: 16 }} data-testid="button-receipt-home" onClick={() => navigate('home')}>Go to Home</button></>;
      return <>
        <PageHead heading="Receipt" sub="Bhaktivedanta Book Stall · ISKCON Pandharpur" />
        <article className="receipt printable-receipt" data-testid={`receipt-bill-${last.no}`}>
          <div className="receipt-head"><LotusMark /><h2>Bhaktivedanta Book Stall</h2><span className="mute">ISKCON Pandharpur · Hare Krishna · Thank you</span></div><hr />
          <PanelRow right={<span className="mute">{shortDate(last.d)} · {last.tm}</span>}><span>Bill #{last.no}</span></PanelRow>
          <div style={{ padding: '12px 0' }}>Customer: <b>{last.c}</b></div>
          {last.it.map(([id, q]) => { const book = bookById(id); return book && <PanelRow key={id} right={format(book.actualPrice * q)}><span>{book.name} ({languageName(book.language)}) × {q}</span></PanelRow>; })}
          <hr />
          <div className="summary-box" style={{ border: 0, padding: 0 }}>
            <div><span>MRP total</span><span>{format(mrp(last, legacyBooks))}</span></div>
            <div><span>Actual total</span><span>{format(subtotal(last, legacyBooks))}</span></div>
            <div className="manual-discount"><span>Owner-set discount {last.discountMode === 'percentage' ? `(${last.discountInput}%)` : ''}</span><span>− {format(last.discount)}</span></div>
            <div className="total"><span>Amount due</span><span>{format(total(last, legacyBooks))}</span></div>
            <div><span className="mute">Payment</span><span>{last.pay}</span></div>
          </div>
        </article>
        {receiptAutoReturn && <div className="receipt-return" data-testid="status-receipt-auto-return" role="status" aria-live="polite">
          <div><Clock3 size={16} aria-hidden="true" /><span>Returning to Sales in 5 seconds</span></div>
          <div className="receipt-progress"><span /></div>
        </div>}
        <div className="actions-grid receipt-actions" style={{ maxWidth: 680, margin: '16px auto' }}>
          <button className="btn outline" data-testid="button-print-receipt" onClick={() => window.print()}><Printer size={16} />Print / PDF</button>
          <button className="btn" data-testid="button-another-sale" onClick={() => navigate('sale')}><Plus size={16} />New sale</button>
        </div>
      </>;
    }

    if (screen === 'stock') {
      const low = legacyBooks.filter(book => book.s <= book.min && book.s > 0).length;
      const out = legacyBooks.filter(book => !book.s).length;
      return <>
        <PageHead heading="Stock status" sub="Current inventory and low-stock alerts" />
        <div className="metric-grid stagger">
          <Metric label="Total stock" value={legacyBooks.reduce((sum, book) => sum + book.s, 0)} testId="total-stock" />
          <Metric label="Stock value" value={format(legacyBooks.reduce((sum, book) => sum + book.s * book.p, 0))} testId="stock-value" />
          <Metric label="Low stock" value={`${low} books`} tone="am" testId="low-stock" />
          <Metric label="Out of stock" value={`${out} books`} tone="rd" testId="out-of-stock" />
        </div>
        <h2 className="section-title">Low-stock alert</h2>
        <div className="panel" data-testid="list-low-stock">
          {legacyBooks.filter(book => book.s <= book.min).sort((a, b) => a.s - b.s).map(book =>
            <PanelRow key={book.id} testId={`row-low-stock-${book.id}`} right={badge(book.s ? `${book.s} left` : '0 left', book.s ? 'am' : 'rd')}>
              <span>{book.n}<small>{languageName(book.l)} · Minimum {book.min}</small></span>
            </PanelRow>)}
          {!legacyBooks.some(book => book.s <= book.min) && <div className="empty" data-testid="empty-low-stock">All books are above their minimum stock levels.</div>}
        </div>
      </>;
    }

    if (screen === 'reports') return <>
      <PageHead heading="Reports" sub="A concise view of sales for a selected date range" />
      <div className="input-grid report-dates" style={{ maxWidth: 560 }}>
        <div><label htmlFor="report-from">From date</label><input id="report-from" data-testid="input-report-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label htmlFor="report-to">To date</label><input id="report-to" data-testid="input-report-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>
      <div className="chips" style={{ marginTop: 17 }} aria-label="Report type">{(['Summary', 'Book-wise', 'Language-wise', 'Payment-wise'] as Report[]).map(option =>
        <button key={option} data-testid={`tab-report-${option.toLowerCase()}`} className={`chip ${report === option ? 'on' : ''}`} aria-pressed={report === option} onClick={() => setReport(option)}>{option}</button>)}</div>
      <div className="metric-grid stagger">
        <Metric label="Total sales" value={format(reportRevenue)} tone="gr" testId="report-sales" />
        <Metric label="Books sold" value={reportQuantity} tone="bl" testId="report-books" />
        <Metric label="Online" value={format(filteredBills.filter(bill => bill.pay === 'Online').reduce((sum, bill) => sum + total(bill, legacyBooks), 0))} testId="report-online" />
        <Metric label="Cash" value={format(filteredBills.filter(bill => bill.pay === 'Cash').reduce((sum, bill) => sum + total(bill, legacyBooks), 0))} testId="report-cash" />
      </div>
      <h2 className="section-title">{report}</h2>
      <div className="panel stagger" data-testid="list-report-results">
        {report === 'Summary' ? [...filteredBills].sort((a, b) => b.no - a.no).map(bill =>
          <PanelRow key={bill.no} testId={`row-report-bill-${bill.no}`} right={<><b>{format(total(bill, legacyBooks))}</b><br />{badge(bill.pay, bill.pay === 'Online' ? 'bl' : 'gr')}</>}>
            <span>Bill #{bill.no} · {bill.c}<small>{shortDate(bill.d)} · {bill.tm}</small></span>
          </PanelRow>) : reportLines.map(([label, data]) =>
          <PanelRow key={label} testId={`row-report-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`} right={<><b>{format(data.revenue)}</b><small>{data.q} books</small></>}>{label}</PanelRow>)}
        {(report === 'Summary' ? filteredBills.length === 0 : reportLines.length === 0) && <div className="empty" data-testid="empty-report">No sales in this date range. Choose different dates.</div>}
      </div>
      <div className="actions-grid report-actions" style={{ marginTop: 14, maxWidth: 500 }}>
        <button className="btn outline" data-testid="button-report-pdf" onClick={() => window.print()}><Printer size={16} />PDF summary</button>
        <button className="btn outline" data-testid="button-report-excel" onClick={() => notify('Excel download is a demo action.')}>Excel</button>
      </div>
      <h2 className="section-title">Sales by weekday</h2>
      <div className="panel" style={{ padding: '20px 12px 12px' }} data-testid="chart-weekly-sales">
        <div className="chart-bars">{[50, 65, 40, 80, 60, 100, 70].map((height, index) => <i key={index} className={index === 5 ? 'strong' : ''} style={{ height: `${height}%` }} />)}</div>
        <div className="chart-labels">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
      </div>
      <article className="print-report" data-testid="print-report-summary">
        <header className="print-report-header">
          <div className="print-brand-mark"><LotusMark width="38" height="30" /></div>
          <div><strong>Bhaktivedanta Book Stall</strong><span>ISKCON Pandharpur · compact sales summary</span></div>
          <div className="print-period"><b>{report} report</b><span>{shortDate(from)} — {shortDate(to)}</span></div>
        </header>
        <div className="print-summary">
          <div><small>Total sales</small><b>{format(reportRevenue)}</b></div>
          <div><small>Owner-set discounts</small><b>{format(reportDiscount)}</b></div>
          <div><small>Total bills</small><b>{filteredBills.length}</b></div>
          <div><small>Books sold</small><b>{reportQuantity}</b></div>
        </div>
        <table className="print-table">
          <thead>{report === 'Summary'
            ? <tr><th>Bill #</th><th>Date</th><th>Customer</th><th>Books</th><th>Payment</th><th>Total</th></tr>
            : <tr><th>{reportLabel}</th><th>Books</th><th>Total sales</th></tr>}</thead>
          <tbody>
            {report === 'Summary' ? [...filteredBills].sort((a, b) => b.no - a.no).map(bill =>
              <tr key={bill.no}><td>#{bill.no}</td><td>{shortDate(bill.d)}</td><td>{bill.c}</td><td>{quantity(bill)}</td><td>{bill.pay}</td><td>{format(total(bill, legacyBooks))}</td></tr>)
              : reportLines.map(([label, data]) => <tr key={label}><td>{label}</td><td>{data.q}</td><td>{format(data.revenue)}</td></tr>)}
            {filteredBills.length === 0 && <tr><td colSpan={report === 'Summary' ? 6 : 3}>No sales in this date range.</td></tr>}
          </tbody>
        </table>
        <footer className="print-report-footer">Bhaktivedanta Book Stall · ISKCON Pandharpur</footer>
      </article>
    </>;

    if (screen === 'more') return <>
      <PageHead heading="More" sub="Stock shortcuts and display preferences" />
      <div className="panel">
        <PanelRow tap testId="button-more-stock" onClick={() => navigate('stock')} right={<ChevronRight size={18} color="var(--mute)" />}>
          <span>Stock status and low-stock alerts<small>Review current book inventory</small></span>
        </PanelRow>
      </div>
      <button className="btn outline theme-toggle" data-testid="button-theme-toggle" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
        {dark ? <Sun size={17} /> : <Moon size={17} />} Switch to {dark ? 'light' : 'dark'} theme
      </button>
      <div className="panel identity-card" data-testid="text-stall-identity">
        <Sparkles size={19} color="var(--saf)" /><span>Bhaktivedanta Book Stall · ISKCON Pandharpur</span>
      </div>
    </>;

    return <AccountScreen onNotify={notify} onBack={goBack} previous={title[history[history.length - 1] || 'home']} />;
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><LotusMark width="31" height="25" /></div><div><strong>Bhaktivedanta</strong><small>Book Stall · ISKCON Pandharpur</small></div></div>
      <div className="nav-label">STALL DESK</div>
      <nav className="side-nav" aria-label="Primary navigation">{navItems.map(({ key, label, icon: Icon }) =>
        <button key={key} data-testid={`nav-${key}`} className={`nav-item ${navKey === key ? 'active' : ''}`} aria-current={navKey === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon />{label}</button>)}</nav>
      <div className="sidebar-foot"><b>Hare Krishna</b>Bhaktivedanta Book Stall<br />ISKCON Pandharpur</div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="mobile-menu" data-testid="button-mobile-menu" aria-label={mobileMenu ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenu} aria-controls="mobile-menu-panel" onClick={() => setMobileMenu(value => !value)}>{mobileMenu ? <X size={17} /> : <Menu size={17} />}</button>
          <div className="crumb" data-testid="text-current-page">Bhaktivedanta Book Stall <span style={{ margin: '0 7px' }}>›</span><strong>{title[screen]}</strong></div>
        </div>
        <div className="top-meta"><span className="date-pill"><SunMedium size={15} />{currentDate}</span>
          <button className="theme-btn" data-testid="button-header-theme" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </header>
      {mobileMenu && <>
        <button className="mobile-menu-backdrop" data-testid="button-close-menu-backdrop" aria-label="Close navigation menu" onClick={() => setMobileMenu(false)} />
        <nav id="mobile-menu-panel" className="panel mobile-menu-panel" aria-label="Primary navigation">
          {navItems.map(({ key, label, icon: Icon }) => <PanelRow key={key} tap testId={`mobile-nav-${key}`} onClick={() => navigate(key)}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon size={17} />{label}</span></PanelRow>)}
        </nav>
      </>}
      <main key={screen} className="content screen-enter" data-testid={`screen-${screen}`}>{page()}</main>
    </div>
    <nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(({ key, label, icon: Icon }) =>
      <button key={key} data-testid={`mobile-tab-${key}`} className={navKey === key ? 'active' : ''} aria-current={navKey === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon />{label}</button>)}</nav>
    {toast && <div className="toast" data-testid="status-toast" role="status">{toast}</div>}
  </div>;
}

function AccountScreen({ onNotify, onBack, previous }: { onNotify: (message: string) => void; onBack: () => void; previous: string }) {
  const { user, loading, isAuthenticated, signOut } = useAuth();
  const [, setLocation] = useLocation();
  
  if (loading) return <>
    <div className="page-head page-heading-row"><button className="back-control" data-testid="button-back-account" aria-label={`Back to ${previous}`} onClick={onBack}><ArrowLeft size={17} /><span>Back</span></button><div><h1>Account</h1><p>Loading account details…</p></div></div>
    <div className="account-loading" data-testid="status-account-loading"><i /><i /><i /><span>Loading account details…</span></div>
  </>;
  
  if (!isAuthenticated || !user) return <>
    <div className="page-head page-heading-row">
      <button className="back-control" data-testid="button-back-account" aria-label={`Back to ${previous}`} onClick={onBack}><ArrowLeft size={17} /><span>Back</span></button>
      <div><h1>Account</h1><p>Optional sign-in for your account.</p></div>
    </div>
    <section className="account-card" data-testid="account-signed-out">
      <div className="account-symbol"><UserRound size={25} /></div>
      <span className="account-kicker">OPTIONAL ACCOUNT</span>
      <h2>Sign in when you need to.</h2>
      <p>Your stall dashboard remains public. This demo keeps inventory, bills and reports in memory; signing in does not protect, save or sync business data.</p>
      <div className="account-actions">
        <Link href="/sign-in" data-testid="link-account-sign-in" className="btn">Sign in <LogIn size={16} /></Link>
        <Link href="/sign-up" data-testid="link-account-sign-up" className="btn outline">Create account</Link>
      </div>
      <small>Account access is separate from the public stall dashboard.</small>
    </section>
  </>;
  
  const fullName = user.displayName || user.email?.split('@')[0] || 'Signed-in account';
  const email = user.email || 'No email address';
  const initials = fullName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  
  return <>
    <div className="page-head page-heading-row">
      <button className="back-control" data-testid="button-back-account" aria-label={`Back to ${previous}`} onClick={onBack}><ArrowLeft size={17} /><span>Back</span></button>
      <div><h1>Account</h1><p>Personal account settings</p></div>
    </div>
    <section className="account-card signed-in-card" data-testid="account-signed-in">
      <div className="account-profile">
        <div className="account-avatar" data-testid="text-account-initials">{initials}</div>
        <div><span className="account-kicker">SIGNED IN</span><h2 data-testid="text-account-name">{fullName}</h2><p data-testid="text-account-email">{email}</p></div>
        <span className="signed-check" aria-label="Signed in"><Check size={16} /></span>
      </div>
      <div className="account-notice"><Sparkles size={17} /><p>The stall dashboard and its demo business data remain public and in-memory. This account does not protect, save or sync sales, inventory or reports.</p></div>
      <button className="btn outline" data-testid="button-account-sign-out" onClick={async () => {
        try { 
          await signOut(); 
          onNotify('Signed out successfully');
          // Redirect to sign-in page after logout
          setLocation('/sign-in');
        }
        catch { onNotify('Unable to sign out right now. Please try again.'); }
      }}><LogOut size={16} />Sign out</button>
    </section>
  </>;
}

function AuthFrame({ children, kind }: { children: ReactNode; kind: 'sign-in' | 'sign-up' }) {
  return <main className="auth-page">
    <div className="auth-topline"><Link href="/" className="auth-brand" data-testid="link-auth-home"><span className="auth-brand-mark"><LotusMark width="30" height="24" /></span><span><b>Bhaktivedanta Book Stall</b><small>ISKCON Pandharpur</small></span></Link><Link href="/" data-testid="link-auth-back-home">Back to dashboard <ChevronRight size={15} /></Link></div>
    <div className="auth-layout">
      <section className="auth-story">
        <div className="auth-story-art"><div className="auth-ornament" /><LotusMark width="110" height="68" /><span>Hare Krishna</span></div>
        <p className="auth-eyebrow">A personal account, if you need one</p>
        <h1>{kind === 'sign-in' ? 'Welcome back.' : 'A place for your account.'}</h1>
        <p>Sign-in is optional. The Bhaktivedanta Book Stall dashboard stays public, and its demo sales and inventory are not protected or synced by this account.</p>
        <div className="auth-assurance"><Check size={16} />Your account is separate from the stall's in-memory demo data.</div>
      </section>
      <section className="auth-widget">
        {children}
        <p className="auth-disclaimer">Signing in only manages your account. It does not save, protect or sync business data.</p>
        <div className="auth-switch">{kind === 'sign-in'
          ? <>New here? <Link href="/sign-up" data-testid="link-auth-switch-sign-up">Create an account</Link></>
          : <>Already registered? <Link href="/sign-in" data-testid="link-auth-switch-sign-in">Sign in</Link></>}</div>
      </section>
    </div>
    <footer className="auth-footer">Bhaktivedanta Book Stall <span>·</span> Public dashboard <span>·</span> ISKCON Pandharpur</footer>
  </main>;
}

function SignInPage() {
  const [, setLocation] = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame kind="sign-in">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            disabled={loading}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthFrame>
  );
}

function SignUpPage() {
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame kind="sign-up">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            disabled={loading}
            autoComplete="new-password"
          />
        </div>
        <div className="form-field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            disabled={loading}
            autoComplete="new-password"
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthFrame>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AuthConnector />
        <AppRoutes />
      </AuthProvider>
    </WouterRouter>
  );
}

function AuthConnector() {
  const auth = useAuth();
  useEffect(() => {
    // Connect Firebase auth token to API client
    setAuthTokenGetter(auth.getIdToken);
  }, [auth]);
  return null;
}

function AppRoutes() {
  const { loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <LotusMark width="80" height="54" />
          <div className="auth-loading-text">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route><NotFound /></Route>
    </Switch>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation('/sign-in');
    }
  }, [isAuthenticated, loading, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

function NotFound() {
  return <main className="auth-page not-found-page">
    <section className="account-card">
      <div className="account-symbol"><Search size={23} /></div>
      <span className="account-kicker">PAGE NOT FOUND</span>
      <h2>This page isn't on the shelf.</h2>
      <p>The address may have changed. Your public dashboard is still right here.</p>
      <Link href="/" data-testid="link-not-found-home" className="btn">Back to dashboard <Home size={16} /></Link>
    </section>
  </main>;
}

export default App;
