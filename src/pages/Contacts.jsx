import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Mail, Phone, MessageCircle, X, Send, Users, Activity,
  Sparkles, Clock, ChevronRight, User,
  Briefcase, Star, Heart, Search,
  Share2, CheckCircle,
  ArrowRight, Copy, Check, Trash2
} from "lucide-react";

// ============= CONTACT CARD =============
function ContactCard({ contact, onOpen, index }) {
  const initials = `${contact.firstName?.charAt(0) || ""}${contact.lastName?.charAt(0) || ""}`.toUpperCase();
  const [isHovered, setIsHovered] = useState(false);

  // Premium gradient collection
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-indigo-500 to-blue-600",
    "from-pink-500 to-rose-600",
    "from-teal-500 to-emerald-600",
  ];
  const gradient = gradients[index % gradients.length];

  // Service icons mapping
  const getServiceIcon = (service) => {
    const icons = {
      consulting: <Briefcase className="h-3 w-3" />,
      development: <Activity className="h-3 w-3" />,
      design: <Sparkles className="h-3 w-3" />,
      marketing: <Users className="h-3 w-3" />,
      support: <Heart className="h-3 w-3" />,
    };
    return icons[service?.toLowerCase()] || <User className="h-3 w-3" />;
  };

  return (
    <article
      tabIndex={0}
      onClick={() => onOpen(contact)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => (e.key === "Enter" ? onOpen(contact) : null)}
      className="group relative flex flex-col h-full bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100/80 hover:border-indigo-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 overflow-hidden"
      aria-labelledby={`contact-${contact._id}-name`}
    >
      {/* Premium animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br from-indigo-50/0 via-purple-50/0 to-pink-50/0 group-hover:from-indigo-50/40 group-hover:via-purple-50/30 group-hover:to-pink-50/20 transition-all duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-2xl p-[1.5px] bg-gradient-to-r from-indigo-400/0 via-purple-400/0 to-indigo-400/0 group-hover:from-indigo-400/40 group-hover:via-purple-400/40 group-hover:to-indigo-400/40 transition-all duration-700">
        <div className="absolute inset-0 rounded-2xl bg-white" />
      </div>

      {/* Top animated bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ${isHovered ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />

      {/* Shimmer effect */}
      <div className={`absolute -inset-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 transition-all duration-1000 ${isHovered ? 'translate-x-full' : '-translate-x-full'}`} />

      <div className="relative p-4 sm:p-5 lg:p-6 z-10">
        {/* Header with avatar and badge */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shadow-indigo-200/50 group-hover:shadow-indigo-300/50 transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3`}>
                {initials || "?"}
              </div>
              {/* Online status */}
              <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm">
                <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-75" />
                <div className="absolute inset-[2px] rounded-full bg-emerald-400" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 id={`contact-${contact._id}-name`} className="text-sm sm:text-base font-bold text-gray-900 leading-tight group-hover:text-indigo-700 transition-colors truncate">
                {contact.firstName} {contact.lastName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                {getServiceIcon(contact.service)}
                <span className="text-xs text-gray-500 font-medium truncate">
                  {contact.service || "General Inquiry"}
                </span>
              </div>
            </div>
          </div>

          {/* Premium service badge */}
          {contact.service && (
            <div className="relative flex-shrink-0 self-start sm:self-center">
              <div className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold bg-gradient-to-r ${gradient} text-white shadow-lg shadow-indigo-200/50 flex items-center gap-1.5 animate-float`}>
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden xs:inline">{contact.service}</span>
                <span className="xs:hidden">{contact.service?.substring(0, 8)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Contact details */}
        <div className="relative mt-4 flex-1 space-y-2 border-t border-gray-100 pt-3 sm:pt-4">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs font-medium text-gray-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-300 group/link"
              aria-label={`Email ${contact.firstName} ${contact.lastName}`}
            >
              <div className="p-1 rounded-lg sm:p-1.5 bg-indigo-50 group-hover/link:bg-indigo-100 transition-colors flex-shrink-0">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 group-hover/link:text-indigo-600 transition-colors" />
              </div>
              <span className="truncate flex-1 text-[11px] sm:text-xs">{contact.email}</span>
              <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-300 opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all flex-shrink-0" />
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs font-medium text-gray-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-300 group/link"
              aria-label={`Call ${contact.firstName} ${contact.lastName}`}
            >
              <div className="p-1 rounded-lg sm:p-1.5 bg-emerald-50 group-hover/link:bg-emerald-100 transition-colors flex-shrink-0">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 group-hover/link:text-emerald-600 transition-colors" />
              </div>
              <span className="truncate flex-1 text-[11px] sm:text-xs">{contact.phone}</span>
              <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-300 opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all flex-shrink-0" />
            </a>
          )}

          {/* Message preview */}
          {contact.message && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen(contact);
              }}
              className="w-full text-left group/msg mt-1 sm:mt-2"
            >
              <div className="relative p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100/50 hover:border-indigo-200 transition-all duration-300">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1 rounded-lg sm:p-1.5 bg-indigo-100/50 flex-shrink-0 mt-0.5">
                    <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] sm:text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Message</span>
                      <span className="h-1 w-1 rounded-full bg-indigo-300" />
                      <span className="font-normal text-gray-400 text-[8px] sm:text-[9px]">preview</span>
                    </p>
                    <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed line-clamp-2">
                      {contact.message}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs font-medium text-indigo-600 group-hover/msg:text-indigo-700 transition-colors">
                      <span className="hidden xs:inline">Read Full Message</span>
                      <span className="xs:hidden">Read More</span>
                      <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 group-hover/msg:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Footer with actions */}
        <div className="relative mt-3 sm:mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-400">
            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span className="hidden xs:inline">Updated recently</span>
            <span className="xs:hidden">Recent</span>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
              <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
              <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ============= CONTACT MODAL =============
function ContactModal({ contact, onClose }) {
  const modalRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const node = modalRef.current;
    if (node) {
      const button = node.querySelector("button, a, [tabindex]:not([tabindex='-1'])");
      button?.focus();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close contact details"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Contact details for ${contact.firstName} ${contact.lastName}`}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] flex flex-col"
      >
        {/* Modal gradient header */}
        <div className="relative h-32 sm:h-36 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-x-5 bottom-4 flex items-center gap-4 sm:inset-x-8 sm:bottom-5 sm:gap-5">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white shadow-xl sm:h-20 sm:w-20 sm:text-2xl">
              {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold leading-tight text-white sm:text-2xl">
                {contact.firstName} {contact.lastName}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-3 sm:text-xs">
                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{contact.service || "General Inquiry"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Active
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all text-white"
            aria-label="Close dialog"
          > 
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="px-5 pb-5 pt-6 sm:px-8 sm:pb-7 md:px-10 md:pb-8 overflow-y-auto flex-1">

          {/* Contact details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="group">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 p-2.5 sm:p-3 rounded-xl bg-gray-50 border border-gray-100 group-hover:border-indigo-200 transition-colors">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-400 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700 flex-1 truncate">{contact.email}</span>
                <button
                  onClick={() => handleCopy(contact.email)}
                  className="p-1 rounded-lg hover:bg-white transition-colors shrink-0"
                  aria-label="Copy email address"
                >
                  {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />}
                </button>
                <a href={`mailto:${contact.email}`} className="p-1 rounded-lg hover:bg-white transition-colors shrink-0" aria-label="Send email">
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                </a>
              </div>
            </div>

            <div className="group">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone Number</label>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 p-2.5 sm:p-3 rounded-xl bg-gray-50 border border-gray-100 group-hover:border-indigo-200 transition-colors">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700 flex-1 truncate">{contact.phone}</span>
                <a href={`tel:${contact.phone}`} className="p-1 rounded-lg hover:bg-white transition-colors shrink-0" aria-label="Call phone number">
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                </a>
              </div>
            </div>
          </div>

          {/* Message section */}
          <div>
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
              <h4 className="text-sm sm:text-base font-bold text-gray-900">Full Message</h4>
              <span className="px-2 py-0.5 text-[8px] sm:text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded-full">Important</span>
            </div>
            <div className="p-3 sm:p-4 md:p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-indigo-50/30 border border-gray-100 text-xs sm:text-sm text-gray-700 max-h-40 sm:max-h-48 md:max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {contact.message || "No message provided"}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end border-t border-gray-100 pt-4 sm:pt-6">
            <button
              onClick={() => {
                // Add delete functionality
              }}
              className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============= MAIN COMPONENT =============
export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://kt-backend-1.onrender.com/api/contact"
      );
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setContacts(result.data);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.service?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterService === "all" || contact.service?.toLowerCase() === filterService;

    return matchesSearch && matchesFilter;
  });

  // Get unique services for filter
  const services = ["all", ...new Set(contacts.map(c => c.service?.toLowerCase()).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Premium Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
          

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Stats card */}
              <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 font-medium">Total</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{filteredContacts.length}</p>
                </div>
              </div>

              {/* Live status */}
              <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-3 bg-white rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-75" />
                  <div className="relative h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Status</p>
                  <p className="text-xs sm:text-sm font-bold text-emerald-700">Live</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-xs sm:text-sm"
                />
              </div>

              {/* Mobile filter toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 flex items-center gap-2 justify-center"
              >
                <span>Filter</span>
                <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{services.length - 1}</span>
              </button>

              {/* Desktop filters */}
              <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
                {services.map((service) => (
                  <button
                    key={service}
                    onClick={() => setFilterService(service)}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                      filterService === service
                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200/50"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600"
                    }`}
                  >
                    {service === "all" ? "All" : service}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile filters dropdown */}
            {mobileMenuOpen && (
              <div className="sm:hidden mt-3 bg-white rounded-2xl border border-gray-200 p-3 shadow-lg">
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <button
                      key={service}
                      onClick={() => {
                        setFilterService(service);
                        setMobileMenuOpen(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                        filterService === service
                          ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200/50"
                          : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600"
                      }`}
                    >
                      {service === "all" ? "All" : service}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl border border-white/50 overflow-hidden p-3 sm:p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 sm:py-16 md:py-20">
              <div className="inline-flex p-4 sm:p-5 md:p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 mb-4">
                <Mail className="h-10 w-10 sm:h-12 sm:w-12 text-indigo-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">No Contact Records</h3>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500 max-w-sm mx-auto px-4">
                No client inquiries found in the system. New messages will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredContacts.map((contact, index) => (
                <ContactCard
                  key={contact._id}
                  contact={contact}
                  onOpen={setSelectedContact}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
 
      {/* Modal */}
      {selectedContact && (
        <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}
    </div>
  );
}