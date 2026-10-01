import { useState, useEffect } from "react";
import { 
  Pencil, Trash2, X, Plus, Briefcase, MapPin, Clock, Users, Tag, List, 
  Search, Filter, ChevronDown, Eye, Sparkles, Building2, Calendar, 
  Award, GraduationCap, Mail, Phone, Globe, Link, CheckCircle, 
  AlertCircle, BarChart3, TrendingUp, Star, BookOpen, Code, 
  LayoutGrid, List as ListIcon, Download, Printer
} from "lucide-react";
import { useConfirm } from "../components/common/ConfirmDialog";

export default function Positions() {
  const { confirm, confirmationDialog } = useConfirm();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); 
  const [viewMode, setViewMode] = useState("grid");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);

  const initialFormState = {
    title: "",
    type: "Full-time",
    category: "",
    desc: "",
    exp: "",
    location: "",
    skills: "",
    responsibilities: "",
    department: "",
    salaryRange: "",
    benefits: "",
    openings: "1",
    priority: "Medium"
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://kt-backend-1.onrender.com/api/position");
      const data = await res.json();
      setPositions(data.data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      const url = editId
        ? `https://kt-backend-1.onrender.com/api/position/${editId}`
        : `https://kt-backend-1.onrender.com/api/position/add`;

      const method = editId ? "PUT" : "POST";

      const payload = {
        ...formData,
        skills: formData.skills
          ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        responsibilities: formData.responsibilities
          ? formData.responsibilities.split(",").map((r) => r.trim()).filter(Boolean)
          : [],
        benefits: formData.benefits
          ? formData.benefits.split(",").map((b) => b.trim()).filter(Boolean)
          : [],
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        setEditId(null);
        setFormData(initialFormState);
        fetchPositions();
        alert(editId ? "Position updated successfully!" : "Position created successfully!");
      } else {
        alert(result.message || "Something went wrong!");
      }
    } catch (error) {
      console.log(error);
      alert("Error saving position!");
    }
  };

  const handleEdit = (pos) => {
    setEditId(pos._id);
    setFormData({
      title: pos.title || "",
      type: pos.type || "",
      category: pos.category || "",
      desc: pos.desc || "",
      exp: pos.exp || "",
      location: pos.location || "",
      skills: Array.isArray(pos.skills) ? pos.skills.join(", ") : "",
      responsibilities: Array.isArray(pos.responsibilities) ? pos.responsibilities.join(", ") : "",
      department: pos.department || "",
      salaryRange: pos.salaryRange || "",
      benefits: Array.isArray(pos.benefits) ? pos.benefits.join(", ") : "",
      openings: pos.openings || "1",
      priority: pos.priority || "Medium"
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Delete position?",
      message: "Are you sure you want to delete this position?",
      confirmLabel: "Delete",
    });
    if (confirmed) {
      try {
        const response = await fetch(`https://kt-backend-1.onrender.com/api/position/${id}`, {
          method: "DELETE",
        });
        const result = await response.json();
        if (result.success) {
          fetchPositions();
          alert("Position deleted successfully!");
        } else {
          alert(result.message || "Failed to delete position!");
        }
      } catch (error) {
        console.log(error);
        alert("Error deleting position!");
      }
    }
  };

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case "full-time":
        return "bg-gradient-to-r from-emerald-500 to-teal-500";
      case "part-time":
        return "bg-gradient-to-r from-purple-500 to-pink-500";
      case "intern":
        return "bg-gradient-to-r from-blue-500 to-cyan-500";
      case "contract":
        return "bg-gradient-to-r from-orange-500 to-amber-500";
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const filteredPositions = positions.filter(pos => {
    const matchesSearch = pos.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pos.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pos.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || pos.type?.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  const stats = {
    total: positions.length,
    fullTime: positions.filter(p => p.type === "Full-time").length,
    partTime: positions.filter(p => p.type === "Part-time").length,
    intern: positions.filter(p => p.type === "Intern").length,
    contract: positions.filter(p => p.type === "Contract").length
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      {confirmationDialog}
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                Positions
              </h1>
              <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                <span>Manage all job positions and openings</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  {positions.length} active
                </span>
              </p>
            </div>
            <button
              onClick={() => {
                setEditId(null);
                setFormData(initialFormState);
                setShowModal(true);
              }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 flex items-center gap-2 font-medium text-sm"
            >
              <Plus className="h-5 w-5" />
              Create Position
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Full-time</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.fullTime}</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Part-time</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.partTime}</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Interns</p>
                  <p className="text-2xl font-bold text-cyan-600">{stats.intern}</p>
                </div>
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Contract</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.contract}</p>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search positions, categories, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="all">All Types</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="intern">Intern</option>
                <option value="contract">Contract</option>
              </select>
              <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "grid" 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "list" 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex justify-center mb-6">
                <div className="p-6 bg-blue-50 rounded-full">
                  <Briefcase className="h-16 w-16 text-blue-400" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">No Positions Found</h3>
              <p className="mt-2 text-gray-500">Get started by creating your first position.</p>
              <button
                onClick={() => {
                  setEditId(null);
                  setFormData(initialFormState);
                  setShowModal(true);
                }}
                className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 inline-flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Create Position
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPositions.map((pos) => (
                  <div
                    key={pos._id}
                    className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                              {pos.title}
                            </h3>
                            {pos.priority && (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(pos.priority)}`}>
                                {pos.priority}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-3 py-1 text-xs font-medium text-white rounded-full ${getTypeColor(pos.type)}`}>
                              {pos.type || "Full-time"}
                            </span>
                            {pos.category && (
                              <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                {pos.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(pos)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(pos._id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {pos.location && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span>{pos.location}</span>
                          </div>
                        )}
                        {pos.exp && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{pos.exp}</span>
                          </div>
                        )}
                        {pos.openings && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span>{pos.openings} opening{pos.openings > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>

                      {pos.desc && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                          {pos.desc}
                        </p>
                      )}

                      {pos.skills && pos.skills.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {pos.skills.slice(0, 3).map((skill, index) => (
                            <span key={index} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded border border-blue-100">
                              {skill}
                            </span>
                          ))}
                          {pos.skills.length > 3 && (
                            <span className="text-xs text-gray-400 px-2 py-1">
                              +{pos.skills.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {filteredPositions.map((pos) => (
                  <div
                    key={pos._id}
                    className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {pos.title}
                          </h3>
                          <span className={`inline-block px-3 py-1 text-xs font-medium text-white rounded-full ${getTypeColor(pos.type)}`}>
                            {pos.type || "Full-time"}
                          </span>
                          {pos.priority && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(pos.priority)}`}>
                              {pos.priority}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                          {pos.category && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4 text-gray-400" />
                              {pos.category}
                            </span>
                          )}
                          {pos.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              {pos.location}
                            </span>
                          )}
                          {pos.exp && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {pos.exp}
                            </span>
                          )}
                          {pos.openings && (
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              {pos.openings} opening{pos.openings > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {pos.skills && pos.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {pos.skills.slice(0, 5).map((skill, index) => (
                              <span key={index} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded border border-blue-100">
                                {skill}
                              </span>
                            ))}
                            {pos.skills.length > 5 && (
                              <span className="text-xs text-gray-400 px-2 py-1">
                                +{pos.skills.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 lg:ml-4">
                        <button
                          onClick={() => handleEdit(pos)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pos._id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowModal(false)} 
          />
          <div className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0 bg-gray-50 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  {editId ? <Pencil className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editId ? "Edit Position" : "Create New Position"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {editId ? "Update position details" : "Add a new job opening"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1">
              <div className="px-6 py-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Position Title *
                    </label>
                    <input
                      name="title"
                      placeholder="e.g. Senior Software Engineer"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Category
                    </label>
                    <input
                      name="category"
                      placeholder="e.g. Engineering"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Department
                    </label>
                    <input
                      name="department"
                      placeholder="e.g. Product Development"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Location
                    </label>
                    <input
                      name="location"
                      placeholder="e.g. Remote, NYC"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Experience
                    </label>
                    <input
                      name="exp"
                      placeholder="e.g. 3-5 years"
                      value={formData.exp}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Openings
                    </label>
                    <input
                      name="openings"
                      type="number"
                      placeholder="Number of openings"
                      value={formData.openings}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Position Type
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Intern">Intern</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Salary Range
                  </label>
                  <input
                    name="salaryRange"
                    placeholder="e.g. $80,000 - $120,000"
                    value={formData.salaryRange}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Skills (Comma separated)
                  </label>
                  <input
                    name="skills"
                    placeholder="HTML, CSS, JavaScript, React"
                    value={formData.skills}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <p className="mt-1 text-xs text-gray-400">Enter skills separated by commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Responsibilities (Comma separated)
                  </label>
                  <textarea
                    name="responsibilities"
                    placeholder="Develop responsive UI, Integrate APIs, Fix bugs"
                    value={formData.responsibilities}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">Enter responsibilities separated by commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Benefits (Comma separated)
                  </label>
                  <input
                    name="benefits"
                    placeholder="Health insurance, 401k, Flexible hours"
                    value={formData.benefits}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <p className="mt-1 text-xs text-gray-400">Enter benefits separated by commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    name="desc"
                    placeholder="Describe the position responsibilities and requirements..."
                    value={formData.desc}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 flex-shrink-0 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-200"
              >
                {editId ? "Update Position" : "Create Position"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Missing import for FileText component
const FileText = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);