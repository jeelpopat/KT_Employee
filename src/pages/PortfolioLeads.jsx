import { useState, useEffect, useMemo } from "react";
import { 
  Users, Mail, FolderOpen, Search, Filter, TrendingUp, Clock, ChevronDown, 
  X, Calendar, User, Briefcase, Tag, AlertCircle, CheckCircle, MessageCircle,
  Phone, MapPin, Building, Star, Award, Sparkles, Zap, Eye, ArrowUpRight,
  BarChart3, PieChart, Activity, Circle, MoreHorizontal, Download, RefreshCw,
  Check, Clock as ClockIcon, AlertTriangle
} from "lucide-react"; 
 
export default function PortfolioLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState("card");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(
        "https://kt-backend-1.onrender.com/api/portfolio/get"
      );
      const data = await res.json();

      if (data.success) {
        const formattedData = data.data.map((item) => ({
          id: item._id,
          clientName: item.fullName || "N/A",
          keyContact: item.email || "N/A",
          projectScope: item.projectTitle || "N/A",
          stage: "Proposal Sent",
          priority: "High",
          createdAt: item.createdAt,
          phone: item.phone || "N/A",
          company: item.company || "N/A",
          message: item.message || "No message provided",
          estimatedValue: "₹5,00,000",
        }));

        setLeads(formattedData);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (lead) => {
    setSelectedLead(lead);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLead(null);
    document.body.style.overflow = 'auto';
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      high: {
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
        dot: "bg-rose-500",
        label: "High",
        icon: AlertTriangle
      },
      medium: {
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-500",
        label: "Medium",
        icon: ClockIcon
      },
      low: {
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
        label: "Low",
        icon: Check
      }
    };
    return configs[priority?.toLowerCase()] || configs.medium;
  };

  const getStageConfig = (stage) => {
    const configs = {
      "proposal sent": {
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Proposal Sent",
        icon: Mail
      },
      "negotiation": {
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-200",
        label: "Negotiation",
        icon: TrendingUp
      },
      "closed": {
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        label: "Closed",
        icon: CheckCircle
      },
      "lost": {
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
        label: "Lost",
        icon: X
      }
    };
    return configs[stage?.toLowerCase()] || configs["proposal sent"];
  };

  const filteredLeads = useMemo(() => {
    let result = leads.filter((lead) => {
      const matchesSearch = lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.keyContact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.projectScope.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = filterPriority === "all" || lead.priority.toLowerCase() === filterPriority;
      const matchesStage = filterStage === "all" || lead.stage.toLowerCase() === filterStage;
      
      return matchesSearch && matchesPriority && matchesStage;
    });

    // Sort results
    switch (sortBy) {
      case "newest":
        return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case "oldest":
        return result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case "priority":
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return result.sort((a, b) => priorityOrder[a.priority.toLowerCase()] - priorityOrder[b.priority.toLowerCase()]);
      default:
        return result;
    }
  }, [leads, searchTerm, filterPriority, filterStage, sortBy]);

  const stats = {
    total: leads.length,
    highPriority: leads.filter(l => l.priority.toLowerCase() === "high").length,
    proposalSent: leads.filter(l => l.stage.toLowerCase() === "proposal sent").length,
    closed: leads.filter(l => l.stage.toLowerCase() === "closed").length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-3 sm:px-4 py-4 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Modern Header with Gradient */}
        <div className="relative mb-6 sm:mb-8 lg:mb-10">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-400/10 blur-3xl" />
          
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/25">
                  <FolderOpen className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Portfolio Leads
                </h1>
              </div>
              <p className="text-sm text-slate-500 ml-1">
                Manage and track all your portfolio inquiries in one place
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all duration-200 hover:shadow-md">
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
              <button className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all duration-200 hover:shadow-md">
                <Download className="h-4 w-4 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex -space-x-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 border-2 border-white flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">AK</span>
                  </div>
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 border-2 border-white flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">RJ</span>
                  </div>
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 border-2 border-white flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">+2</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-600">Team</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: "Total Leads", value: stats.total, icon: Users, color: "from-blue-500 to-blue-600", bg: "bg-blue-50" },
            { label: "High Priority", value: stats.highPriority, icon: AlertTriangle, color: "from-rose-500 to-rose-600", bg: "bg-rose-50" },
            { label: "Proposal Sent", value: stats.proposalSent, icon: Mail, color: "from-indigo-500 to-indigo-600", bg: "bg-indigo-50" },
            { label: "Closed Deals", value: stats.closed, icon: CheckCircle, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50" }
          ].map((stat, idx) => (
            <div key={idx} className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-slate-200">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:from-blue-50/50 rounded-2xl transition-all duration-500" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg shadow-${stat.color.split(' ')[1]?.split('-')[1]}-500/20`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="relative mt-2 flex items-center gap-1">
                <span className="text-xs text-emerald-600 font-medium">↑ 12%</span>
                <span className="text-xs text-slate-400">from last month</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          {/* Search and Filter Bar - Modern Design */}
          <div className="p-4 sm:p-6 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/50 to-white">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or project..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 flex items-center gap-2 ${
                      showFilters 
                        ? "bg-blue-50 text-blue-600 border-2 border-blue-200" 
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="hidden xs:inline">Filters</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div className="hidden sm:flex bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() => setViewMode("card")}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${
                        viewMode === "card" ? "bg-white shadow-sm" : "hover:bg-slate-200"
                      }`}
                    >
                      <BarChart3 className="h-4 w-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${
                        viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-slate-200"
                      }`}
                    >
                      <PieChart className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Options - Enhanced */}
              {showFilters && (
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200/70 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Priority
                    </label>
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                      {["all", "high", "medium", "low"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setFilterPriority(p)}
                          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 capitalize ${
                            filterPriority === p
                              ? "bg-white shadow-sm text-slate-900"
                              : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {p === "all" ? "All" : p}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Stage
                    </label>
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-wrap">
                      {["all", "proposal sent", "negotiation", "closed", "lost"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setFilterStage(s)}
                          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 capitalize ${
                            filterStage === s
                              ? "bg-white shadow-sm text-slate-900"
                              : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {s === "all" ? "All" : s}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="priority">Priority</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFilterPriority("all");
                        setFilterStage("all");
                        setSortBy("newest");
                        setSearchTerm("");
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-16 sm:py-20">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl" />
                  <div className="relative rounded-full bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
                    <FolderOpen className="h-8 w-8 text-blue-400" />
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {searchTerm || filterPriority !== "all" || filterStage !== "all" ? "No Results Found" : "No Portfolio Leads"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm || filterPriority !== "all" || filterStage !== "all"
                  ? "Try adjusting your search or filter terms"
                  : "No portfolio inquiries found in the system."}
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              {/* Modern Card View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => {
                  const priorityConfig = getPriorityConfig(lead.priority);
                  const stageConfig = getStageConfig(lead.stage);
                  const PriorityIcon = priorityConfig.icon;
                  const StageIcon = stageConfig.icon;
                  
                  return (
                    <div
                      key={lead.id}
                      onClick={() => openDetails(lead)}
                      className="group relative bg-white rounded-2xl border border-slate-200/70 hover:border-blue-200/70 p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-blue-50/0 to-blue-50/0 group-hover:from-blue-50/30 group-hover:via-blue-50/10 rounded-2xl transition-all duration-500" />
                      
                      <div className="relative">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative flex-shrink-0">
                              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/25">
                                {lead.clientName.charAt(0)}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${priorityConfig.dot} ring-2 ring-white`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {lead.clientName}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">{lead.projectScope}</p>
                            </div>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-200">
                            <MoreHorizontal className="h-4 w-4 text-slate-400" />
                          </button>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg ${priorityConfig.bg} ${priorityConfig.color} border ${priorityConfig.border}`}>
                            <PriorityIcon className="h-3 w-3" />
                            {priorityConfig.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg ${stageConfig.bg} ${stageConfig.color} border ${stageConfig.border}`}>
                            <StageIcon className="h-3 w-3" />
                            {stageConfig.label}
                          </span>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                            <a
                              href={`mailto:${lead.keyContact}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-blue-600 hover:underline truncate"
                            >
                              {lead.keyContact}
                            </a>
                          </div>
                          {lead.company && lead.company !== "N/A" && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Building className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{lead.company}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              }) : "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-blue-600 group-hover:gap-2 transition-all duration-200">
                            <span className="font-medium">View Details</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Modal - Enhanced Design */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal} />
          
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            {/* Header with Gradient */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-3xl">
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-2xl font-bold text-white shadow-xl flex-shrink-0 border-2 border-white/30">
                  {selectedLead.clientName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedLead.clientName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium border border-white/20 bg-white/10 text-white backdrop-blur-sm`}>
                      <AlertTriangle className="h-3 w-3" />
                      {selectedLead.priority}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium border border-white/20 bg-white/10 text-white backdrop-blur-sm`}>
                      <Mail className="h-3 w-3" />
                      {selectedLead.stage}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Contact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="group p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Email</span>
                  </div>
                  <a 
                    href={`mailto:${selectedLead.keyContact}`}
                    className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline break-all"
                  >
                    {selectedLead.keyContact}
                  </a>
                </div>

                {selectedLead.phone && selectedLead.phone !== "N/A" && (
                  <div className="group p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-emerald-600 mb-2">
                      <Phone className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Phone</span>
                    </div>
                    <a 
                      href={`tel:${selectedLead.phone}`}
                      className="text-sm font-medium text-slate-900 hover:text-emerald-600 hover:underline"
                    >
                      {selectedLead.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Project & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <FolderOpen className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Project</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{selectedLead.projectScope}</p>
                </div>

                {selectedLead.company && selectedLead.company !== "N/A" && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <Building className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Company</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{selectedLead.company}</p>
                  </div>
                )}
              </div>

              {/* Value & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl border border-purple-100">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <Award className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Estimated Value</span>
                  </div>
                  <p className="text-lg font-bold text-purple-700">{selectedLead.estimatedValue || "N/A"}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-100">
                  <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Received On</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric"
                    }) : "N/A"}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 mb-3">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Message</span>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedLead.message || "No message provided"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <a
                  href={`mailto:${selectedLead.keyContact}`}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35"
                >
                  <Mail className="h-4 w-4" />
                  Send Email
                </a>
                {selectedLead.phone && selectedLead.phone !== "N/A" && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35"
                  >
                    <Phone className="h-4 w-4" />
                    Call Client
                  </a>
                )}
                <button
                  onClick={closeModal}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}