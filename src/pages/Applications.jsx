// import { useState, useEffect } from "react";

// const INITIAL_ROUND_FORM = {
//   roundType: "",
//   interviewerName: "",
//   date: "",
//   mode: "",
//   feedback: "",
//   rating: "",
//   status: "",
// };

// export default function Applications() {
//   const [applications, setApplications] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [interviewLoading, setInterviewLoading] = useState(null);
//   const [showInterviewModal, setShowInterviewModal] = useState(false);
//   const [selectedApp, setSelectedApp] = useState(null);
//   const [showRoundModal, setShowRoundModal] = useState(false);
//   const [roundForm, setRoundForm] = useState(INITIAL_ROUND_FORM);

//   useEffect(() => {
//     fetchApplications();
//   }, []);

//   const fetchApplications = async () => {
//     try {
//       setLoading(true);
//       const response = await fetch(
//         "https://kt-backend-1.onrender.com/api/application/all"
//       );
//       const result = await response.json();
//       if (result.success) {
//         setApplications(result.data);
//       }
//     } catch (error) {
//       console.error("Error fetching applications:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleRoundChange = (e) => {
//     const { name, value } = e.target;
//     setRoundForm((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const resetModalsAndForm = () => {
//     setShowInterviewModal(false);
//     setShowRoundModal(false);
//     setSelectedApp(null);
//     setRoundForm(INITIAL_ROUND_FORM);
//   };

//   const scheduleInterview = async () => {
//     try {
//       if (!selectedApp) return;

//       setInterviewLoading(selectedApp._id);

//       const interviewPayload = {
//         candidateId: selectedApp._id,
//         interviewerName: roundForm.interviewerName,
//         date: roundForm.date,
//         mode: roundForm.mode,
//         feedback: roundForm.feedback,
//         rating: Number(roundForm.rating),
//         status: roundForm.status,
//       };

//       const interviewRes = await fetch(
//         "https://kt-backend-1.onrender.com/api/interviewRound/addInterview",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(interviewPayload),
//         }
//       );

//       const interviewResult = await interviewRes.json();

//       if (!interviewResult.success) {
//         alert("Interview schedule failed");
//         return;
//       }

//       const interviewId = interviewResult.data._id;

//       const roundPayload = {
//         interviewId,
//         roundType: roundForm.roundType,
//         interviewerName: roundForm.interviewerName,
//         rating: Number(roundForm.rating),
//         status: roundForm.status,
//       };

//       const roundRes = await fetch(
//         "https://kt-backend-1.onrender.com/api/interviewRound/add",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(roundPayload),
//         }
//       );

//       const roundResult = await roundRes.json();

//       if (roundResult.success) {
//         alert("Interview & First Round Scheduled Successfully!");

//         setApplications((prev) =>
//           prev.map((item) =>
//             item._id === selectedApp._id
//               ? { ...item, status: "interview", interviewId }
//               : item
//           )
//         );
//         resetModalsAndForm();
//       } else {
//         alert("Round creation failed");
//       }
//     } catch (error) {
//       console.error(error);
//       alert("Something went wrong processing your request");
//     } finally {
//       setInterviewLoading(null);
//     }
//   };

//   const addRound = async () => {
//     try {
//       if (!selectedApp?.interviewId) {
//         alert("No interview ID associated with this candidate.");
//         return;
//       }

//       setInterviewLoading(selectedApp._id);

//       const payload = {
//         interviewId: selectedApp.interviewId,
//         roundType: roundForm.roundType,
//         interviewerName: roundForm.interviewerName,
//         feedback: roundForm.feedback,
//         rating: Number(roundForm.rating),
//         status: roundForm.status,
//       };

//       const res = await fetch(
//         "https://kt-backend-1.onrender.com/api/interviewRound/add",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(payload),
//         }
//       );

//       const result = await res.json();

//       if (result.success) {
//         alert("Subsequent Round Added Successfully!");
        
//         if (roundForm.status) {
//           setApplications((prev) =>
//             prev.map((item) =>
//               item._id === selectedApp._id
//                 ? { ...item, status: roundForm.status === 'passed' ? 'selected' : item.status }
//                 : item
//             )
//           );
//         }
        
//         resetModalsAndForm();
//       } else {
//         alert("Failed to add round.");
//       }
//     } catch (error) {
//       console.error(error);
//       alert("Something went wrong");
//     } finally {
//       setInterviewLoading(null);
//     }
//   };

//   const getStatusColor = (status) => {
//     switch (status?.toLowerCase()) {
//       case "selected":
//       case "passed":
//         return "bg-green-100 text-green-800 border-green-300";
//       case "interview":
//       case "scheduled":
//         return "bg-yellow-100 text-yellow-800 border-yellow-300";
//       case "applied":
//         return "bg-blue-100 text-blue-800 border-blue-300";
//       case "failed":
//         return "bg-red-100 text-red-800 border-red-300";
//       default:
//         return "bg-gray-100 text-gray-800 border-gray-300";
//     }
//   };

//   return (
//     <div className="p-4 max-w-7xl mx-auto">
//       {/* Header */}
//       <div className="mb-5">
//         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
//               Applications
//             </h1>
//             <p className="text-sm text-gray-500">
//               Manage and track all candidate applications
//             </p>
//           </div>
//           <div className="flex items-center gap-3">
//             <div className="px-3 py-1.5 bg-white border border-gray-300">
//               <span className="text-sm text-gray-600">Total: </span>
//               <span className="font-semibold text-gray-900">{applications.length}</span>
//             </div>
//             <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-300">
//               <span className="relative flex h-2 w-2">
//                 <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 opacity-75"></span>
//                 <span className="relative inline-flex h-2 w-2 bg-green-500"></span>
//               </span>
//               <span className="text-xs font-medium text-green-700">Live</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="bg-white border border-gray-300">
//         {loading ? (
//           <div className="flex flex-col items-center justify-center py-12">
//             <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
//             <p className="mt-3 text-sm text-gray-500">Loading applications...</p>
//           </div>
//         ) : applications.length === 0 ? (
//           <div className="text-center py-12">
//             <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
//             </svg>
//             <h3 className="mt-2 text-sm font-medium text-gray-900">No applications</h3>
//             <p className="mt-1 text-sm text-gray-500">No applicant records found in the system.</p>
//           </div>
//         ) : (
//           <>
//             {/* Desktop Table */}
//             <div className="hidden sm:block overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Candidate
//                     </th>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Role
//                     </th>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Portfolio
//                     </th>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Resume
//                     </th>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Applied
//                     </th>
//                     <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Action
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {applications.map((app) => (
//                     <tr key={app._id} className="hover:bg-gray-50">
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <div className="flex items-center">
//                           <div className="flex-shrink-0 h-8 w-8 bg-blue-100 flex items-center justify-center border border-blue-300">
//                             <span className="text-sm font-medium text-blue-600">
//                               {app.firstName?.[0]}{app.lastName?.[0]}
//                             </span>
//                           </div>
//                           <div className="ml-3">
//                             <p className="text-sm font-medium text-gray-900">
//                               {app.firstName} {app.lastName}
//                             </p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300">
//                           {app.role || "Not specified"}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         {app.portfolioUrl ? (
//                           <a 
//                             href={app.portfolioUrl} 
//                             target="_blank" 
//                             rel="noreferrer" 
//                             className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
//                           >
//                             View
//                           </a>
//                         ) : (
//                           <span className="text-sm text-gray-400">N/A</span>
//                         )}
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         {app.resumeFileUrl ? (
//                           <a 
//                             href={app.resumeFileUrl} 
//                             target="_blank" 
//                             rel="noreferrer" 
//                             className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
//                           >
//                             View PDF
//                           </a>
//                         ) : (
//                           <span className="text-sm text-gray-400">N/A</span>
//                         )}
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <span className={`px-2 py-1 text-xs font-medium border ${getStatusColor(app.status)}`}>
//                           {app.status || "Unknown"}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
//                         {new Date(app.createdAt).toLocaleDateString("en-IN", {
//                           day: "2-digit",
//                           month: "short",
//                           year: "numeric"
//                         })}
//                       </td>
//                       <td className="px-4 py-3 whitespace-nowrap text-right">
//                         {app.status !== "interview" ? (
//                           <button
//                             disabled={interviewLoading === app._id}
//                             onClick={() => {
//                               setSelectedApp(app);
//                               setShowInterviewModal(true);
//                             }}
//                             className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                           >
//                             {interviewLoading === app._id ? "..." : "Schedule"}
//                           </button>
//                         ) : (
//                           <button
//                             disabled={interviewLoading === app._id}
//                             onClick={() => {
//                               setSelectedApp(app);
//                               setShowRoundModal(true);
//                             }}
//                             className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                           >
//                             {interviewLoading === app._id ? "..." : "Add Round"}
//                           </button>
//                         )}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>

//             {/* Mobile Cards */}
//             <div className="sm:hidden divide-y divide-gray-200">
//               {applications.map((app) => (
//                 <div key={app._id} className="p-4 hover:bg-gray-50">
//                   <div className="flex items-start justify-between">
//                     <div className="flex items-center">
//                       <div className="flex-shrink-0 h-9 w-9 bg-blue-100 flex items-center justify-center border border-blue-300">
//                         <span className="text-sm font-medium text-blue-600">
//                           {app.firstName?.[0]}{app.lastName?.[0]}
//                         </span>
//                       </div>
//                       <div className="ml-3">
//                         <p className="text-sm font-medium text-gray-900">
//                           {app.firstName} {app.lastName}
//                         </p>
//                         <p className="text-xs text-gray-500">
//                           {app.role || "N/A"}
//                         </p>
//                       </div>
//                     </div>
//                     <span className={`px-2 py-1 text-xs font-medium border ${getStatusColor(app.status)}`}>
//                       {app.status || "Unknown"}
//                     </span>
//                   </div>

//                   <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
//                     <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
//                       <span className="text-gray-500">Applied</span>
//                       <span className="font-medium text-gray-700">
//                         {new Date(app.createdAt).toLocaleDateString("en-IN")}
//                       </span>
//                     </div>
//                     <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
//                       <span className="text-gray-500">Portfolio</span>
//                       {app.portfolioUrl ? (
//                         <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
//                           View
//                         </a>
//                       ) : (
//                         <span className="text-gray-400">N/A</span>
//                       )}
//                     </div>
//                     <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
//                       <span className="text-gray-500">Resume</span>
//                       {app.resumeFileUrl ? (
//                         <a href={app.resumeFileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
//                           View PDF
//                         </a>
//                       ) : (
//                         <span className="text-gray-400">N/A</span>
//                       )}
//                     </div>
//                   </div>

//                   <div className="mt-3">
//                     {app.status !== "interview" ? (
//                       <button
//                         disabled={interviewLoading === app._id}
//                         onClick={() => {
//                           setSelectedApp(app);
//                           setShowInterviewModal(true);
//                         }}
//                         className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                       >
//                         {interviewLoading === app._id ? "Processing..." : "Schedule Interview"}
//                       </button>
//                     ) : (
//                       <button
//                         disabled={interviewLoading === app._id}
//                         onClick={() => {
//                           setSelectedApp(app);
//                           setShowRoundModal(true);
//                         }}
//                         className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                       >
//                         {interviewLoading === app._id ? "Processing..." : "Add New Round"}
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </>
//         )}
//       </div>

//       {/* Schedule Interview Modal */}
//       {showInterviewModal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
//           <div className="bg-white border border-gray-300 max-w-md w-full max-h-[90vh] overflow-y-auto p-5">
//             <div className="flex items-center justify-between mb-4">
//               <div>
//                 <h2 className="text-lg font-bold text-gray-900">Schedule Interview</h2>
//                 <p className="text-sm text-gray-500">
//                   For {selectedApp?.firstName} {selectedApp?.lastName}
//                 </p>
//               </div>
//               <button
//                 onClick={resetModalsAndForm}
//                 className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
//               >
//                 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>

//             <div className="space-y-3">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Interviewer Name
//                 </label>
//                 <input
//                   type="text"
//                   name="interviewerName"
//                   placeholder="Enter interviewer name"
//                   value={roundForm.interviewerName}
//                   onChange={handleRoundChange}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Date & Time
//                 </label>
//                 <input
//                   type="datetime-local"
//                   name="date"
//                   value={roundForm.date}
//                   onChange={handleRoundChange}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Mode
//                   </label>
//                   <select
//                     name="mode"
//                     value={roundForm.mode}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   >
//                     <option value="">Select</option>
//                     <option value="online">Online</option>
//                     <option value="offline">Offline</option>
//                   </select>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Status
//                   </label>
//                   <select
//                     name="status"
//                     value={roundForm.status}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   >
//                     <option value="">Select</option>
//                     <option value="scheduled">Scheduled</option>
//                     <option value="pending">Pending</option>
//                     <option value="passed">Passed</option>
//                     <option value="failed">Failed</option>
//                   </select>
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Round Type
//                   </label>
//                   <select
//                     name="roundType"
//                     value={roundForm.roundType}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   >
//                     <option value="">Select</option>
//                     <option value="technical_round">Technical</option>
//                     <option value="hr_round">HR</option>
//                     <option value="final_round">Final</option>
//                   </select>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Rating (1-5)
//                   </label>
//                   <input
//                     type="number"
//                     min="1"
//                     max="5"
//                     name="rating"
//                     placeholder="Rating"
//                     value={roundForm.rating}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   />
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Feedback
//                 </label>
//                 <textarea
//                   name="feedback"
//                   placeholder="Enter feedback..."
//                   value={roundForm.feedback}
//                   onChange={handleRoundChange}
//                   rows={3}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
//                 />
//               </div>
//             </div>

//             <div className="flex gap-3 mt-5">
//               <button
//                 onClick={resetModalsAndForm}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={scheduleInterview}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700"
//               >
//                 Schedule
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Add Round Modal */}
//       {showRoundModal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
//           <div className="bg-white border border-gray-300 max-w-md w-full max-h-[90vh] overflow-y-auto p-5">
//             <div className="flex items-center justify-between mb-4">
//               <div>
//                 <h2 className="text-lg font-bold text-gray-900">Add Round</h2>
//                 <p className="text-sm text-gray-500">
//                   For {selectedApp?.firstName} {selectedApp?.lastName}
//                 </p>
//               </div>
//               <button
//                 onClick={resetModalsAndForm}
//                 className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
//               >
//                 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>

//             <div className="space-y-3">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Round Type
//                 </label>
//                 <select
//                   name="roundType"
//                   value={roundForm.roundType}
//                   onChange={handleRoundChange}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
//                 >
//                   <option value="">Select Round Type</option>
//                   <option value="technical_round">Technical Round</option>
//                   <option value="hr_round">HR Round</option>
//                   <option value="final_round">Final Round</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Interviewer Name
//                 </label>
//                 <input
//                   type="text"
//                   name="interviewerName"
//                   placeholder="Enter interviewer name"
//                   value={roundForm.interviewerName}
//                   onChange={handleRoundChange}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                   Feedback
//                 </label>
//                 <textarea
//                   name="feedback"
//                   placeholder="Enter feedback..."
//                   value={roundForm.feedback}
//                   onChange={handleRoundChange}
//                   rows={3}
//                   className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
//                 />
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Rating (1-5)
//                   </label>
//                   <input
//                     type="number"
//                     min="1"
//                     max="5"
//                     name="rating"
//                     placeholder="1 to 5"
//                     value={roundForm.rating}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-0.5">
//                     Status
//                   </label>
//                   <select
//                     name="status"
//                     value={roundForm.status}
//                     onChange={handleRoundChange}
//                     className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
//                   >
//                     <option value="">Select</option>
//                     <option value="scheduled">Scheduled</option>
//                     <option value="pending">Pending</option>
//                     <option value="passed">Passed</option>
//                     <option value="failed">Failed</option>
//                   </select>
//                 </div>
//               </div>
//             </div>

//             <div className="flex gap-3 mt-5">
//               <button
//                 onClick={resetModalsAndForm}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={addRound}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700"
//               >
//                 Add Round
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

import { useState, useEffect } from "react";

const INITIAL_ROUND_FORM = {
  roundType: "",
  interviewerName: "",
  date: "",
  mode: "",
  feedback: "",
  rating: "",
  status: "",
};

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [interviewLoading, setInterviewLoading] = useState(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundForm, setRoundForm] = useState(INITIAL_ROUND_FORM);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://kt-backend-1.onrender.com/api/application/all"
      );
      const result = await response.json();
      if (result.success) {
        setApplications(result.data);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoundChange = (e) => {
    const { name, value } = e.target;
    setRoundForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetModalsAndForm = () => {
    setShowInterviewModal(false);
    setShowRoundModal(false);
    setSelectedApp(null);
    setRoundForm(INITIAL_ROUND_FORM);
  };

  const scheduleInterview = async () => {
    try {
      if (!selectedApp) return;

      setInterviewLoading(selectedApp._id);

      const interviewPayload = {
        candidateId: selectedApp._id,
        interviewerName: roundForm.interviewerName,
        date: roundForm.date,
        mode: roundForm.mode,
        feedback: roundForm.feedback,
        rating: Number(roundForm.rating),
        status: roundForm.status,
      };

      const interviewRes = await fetch(
        "https://kt-backend-1.onrender.com/api/interviewRound/addInterview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(interviewPayload),
        }
      );

      const interviewResult = await interviewRes.json();

      if (!interviewResult.success) {
        alert("Interview schedule failed");
        return;
      }

      const interviewId = interviewResult.data._id;

      const roundPayload = {
        interviewId,
        roundType: roundForm.roundType,
        interviewerName: roundForm.interviewerName,
        rating: Number(roundForm.rating),
        status: roundForm.status,
      };

      const roundRes = await fetch(
        "https://kt-backend-1.onrender.com/api/interviewRound/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roundPayload),
        }
      );

      const roundResult = await roundRes.json();

      if (roundResult.success) {
        alert("Interview & First Round Scheduled Successfully!");

        setApplications((prev) =>
          prev.map((item) =>
            item._id === selectedApp._id
              ? { ...item, status: "interview", interviewId }
              : item
          )
        );
        resetModalsAndForm();
      } else {
        alert("Round creation failed");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong processing your request");
    } finally {
      setInterviewLoading(null);
    }
  };

  const addRound = async () => {
    try {
      if (!selectedApp?.interviewId) {
        alert("No interview ID associated with this candidate.");
        return;
      }

      setInterviewLoading(selectedApp._id);

      const payload = {
        interviewId: selectedApp.interviewId,
        roundType: roundForm.roundType,
        interviewerName: roundForm.interviewerName,
        feedback: roundForm.feedback,
        rating: Number(roundForm.rating),
        status: roundForm.status,
      };

      const res = await fetch(
        "https://kt-backend-1.onrender.com/api/interviewRound/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();

      if (result.success) {
        alert("Subsequent Round Added Successfully!");
        
        if (roundForm.status) {
          setApplications((prev) =>
            prev.map((item) =>
              item._id === selectedApp._id
                ? { ...item, status: roundForm.status === 'passed' ? 'selected' : item.status }
                : item
            )
          );
        }
        
        resetModalsAndForm();
      } else {
        alert("Failed to add round.");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setInterviewLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "selected":
      case "passed":
        return "bg-green-100 text-green-800 border-green-300";
      case "interview":
      case "scheduled":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "applied":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
              Applications
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Manage and track all candidate applications
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-lg">
              <span className="text-xs sm:text-sm text-gray-600">Total: </span>
              <span className="font-semibold text-gray-900">{applications.length}</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-green-50 border border-green-300 rounded-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 opacity-75 rounded-full"></span>
                <span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-green-700">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white border border-gray-300 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm sm:text-base font-medium text-gray-900">No applications</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">No applicant records found in the system.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Portfolio
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resume
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applied
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {applications.map((app) => (
                    <tr key={app._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 flex items-center justify-center border border-blue-300 rounded">
                            <span className="text-xs sm:text-sm font-medium text-blue-600">
                              {app.firstName?.[0]}{app.lastName?.[0]}
                            </span>
                          </div>
                          <div className="ml-2 sm:ml-3">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-[150px]">
                              {app.firstName} {app.lastName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-[10px] sm:text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded">
                          {app.role || "Not specified"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {app.portfolioUrl ? (
                          <a 
                            href={app.portfolioUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {app.resumeFileUrl ? (
                          <a 
                            href={app.resumeFileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View PDF
                          </a>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-[10px] sm:text-xs font-medium border rounded-full ${getStatusColor(app.status)}`}>
                          {app.status || "Unknown"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                        {app.status !== "interview" ? (
                          <button
                            disabled={interviewLoading === app._id}
                            onClick={() => {
                              setSelectedApp(app);
                              setShowInterviewModal(true);
                            }}
                            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {interviewLoading === app._id ? "..." : "Schedule"}
                          </button>
                        ) : (
                          <button
                            disabled={interviewLoading === app._id}
                            onClick={() => {
                              setSelectedApp(app);
                              setShowRoundModal(true);
                            }}
                            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {interviewLoading === app._id ? "..." : "Add Round"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {applications.map((app) => (
                <div key={app._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex-shrink-0 h-9 w-9 bg-blue-100 flex items-center justify-center border border-blue-300 rounded">
                        <span className="text-sm font-medium text-blue-600">
                          {app.firstName?.[0]}{app.lastName?.[0]}
                        </span>
                      </div>
                      <div className="ml-3 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {app.firstName} {app.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {app.role || "N/A"}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-[10px] font-medium border rounded-full flex-shrink-0 ml-2 ${getStatusColor(app.status)}`}>
                      {app.status || "Unknown"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-gray-500">Applied</span>
                      <span className="font-medium text-gray-700">
                        {new Date(app.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-gray-500">Portfolio</span>
                      {app.portfolioUrl ? (
                        <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-gray-500">Resume</span>
                      {app.resumeFileUrl ? (
                        <a href={app.resumeFileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                          View PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    {app.status !== "interview" ? (
                      <button
                        disabled={interviewLoading === app._id}
                        onClick={() => {
                          setSelectedApp(app);
                          setShowInterviewModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {interviewLoading === app._id ? "Processing..." : "Schedule Interview"}
                      </button>
                    ) : (
                      <button
                        disabled={interviewLoading === app._id}
                        onClick={() => {
                          setSelectedApp(app);
                          setShowRoundModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {interviewLoading === app._id ? "Processing..." : "Add New Round"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Schedule Interview Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <div className="bg-white border border-gray-300 max-w-md w-full max-h-[95vh] overflow-y-auto rounded-lg sm:rounded-xl shadow-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Schedule Interview</h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  For {selectedApp?.firstName} {selectedApp?.lastName}
                </p>
              </div>
              <button
                onClick={resetModalsAndForm}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Interviewer Name
                </label>
                <input
                  type="text"
                  name="interviewerName"
                  placeholder="Enter interviewer name"
                  value={roundForm.interviewerName}
                  onChange={handleRoundChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="date"
                  value={roundForm.date}
                  onChange={handleRoundChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Mode
                  </label>
                  <select
                    name="mode"
                    value={roundForm.mode}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                  >
                    <option value="">Select</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={roundForm.status}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                  >
                    <option value="">Select</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Round Type
                  </label>
                  <select
                    name="roundType"
                    value={roundForm.roundType}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                  >
                    <option value="">Select</option>
                    <option value="technical_round">Technical</option>
                    <option value="hr_round">HR</option>
                    <option value="final_round">Final</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    name="rating"
                    placeholder="Rating"
                    value={roundForm.rating}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Feedback
                </label>
                <textarea
                  name="feedback"
                  placeholder="Enter feedback..."
                  value={roundForm.feedback}
                  onChange={handleRoundChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg resize-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-5 sm:mt-6">
              <button
                onClick={resetModalsAndForm}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={scheduleInterview}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded-lg transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Round Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <div className="bg-white border border-gray-300 max-w-md w-full max-h-[95vh] overflow-y-auto rounded-lg sm:rounded-xl shadow-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Add Round</h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  For {selectedApp?.firstName} {selectedApp?.lastName}
                </p>
              </div>
              <button
                onClick={resetModalsAndForm}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Round Type
                </label>
                <select
                  name="roundType"
                  value={roundForm.roundType}
                  onChange={handleRoundChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg transition-all"
                >
                  <option value="">Select Round Type</option>
                  <option value="technical_round">Technical Round</option>
                  <option value="hr_round">HR Round</option>
                  <option value="final_round">Final Round</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Interviewer Name
                </label>
                <input
                  type="text"
                  name="interviewerName"
                  placeholder="Enter interviewer name"
                  value={roundForm.interviewerName}
                  onChange={handleRoundChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg transition-all"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Feedback
                </label>
                <textarea
                  name="feedback"
                  placeholder="Enter feedback..."
                  value={roundForm.feedback}
                  onChange={handleRoundChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg resize-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    name="rating"
                    placeholder="1 to 5"
                    value={roundForm.rating}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={roundForm.status}
                    onChange={handleRoundChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg transition-all"
                  >
                    <option value="">Select</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-5 sm:mt-6">
              <button
                onClick={resetModalsAndForm}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addRound}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-green-700 rounded-lg transition-colors"
              >
                Add Round
              </button>
            </div> 
          </div>
        </div>
      )}
    </div>
  );
}