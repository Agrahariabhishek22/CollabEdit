import React from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, CheckCircle2, Hourglass, ArrowRight } from "lucide-react"; // Icons import kiye

const DashboardPage = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Create Capsules",
      description: "Do create your new Capsule",
      icon: <PlusCircle className="w-10 h-10 text-indigo-600" />,
      path: "/create-capsule",
      color: "border-indigo-500 hover:bg-indigo-50",
    },
    {
      title: "Delivered Capsules",
      description: "To see your Delivered Capsule",
      icon: <CheckCircle2 className="w-10 h-10 text-green-600" />,
      path: "/delivered",
      color: "border-green-500 hover:bg-green-50",
    },
    {
      title: "Undelivered Capsules",
      description: "Capsules to be delivered in the future",
      icon: <Hourglass className="w-10 h-10 text-amber-600" />,
      path: "/undelivered",
      color: "border-amber-500 hover:bg-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">
          Dashboard Overview
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              onClick={() => navigate(card.path)}
              className={`group cursor-pointer bg-white p-8 rounded-xl border-t-4 shadow-sm transition-all duration-300 transform hover:-translate-y-2 ${card.color}`}
            >
              <div className="mb-5 transition-transform ">
                {card.icon}
              </div>
              
              <h3 className="text-xl font-bold text-slate-800">
                {card.title}
              </h3>
              
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                {card.description}
              </p>

              <div className="mt-6 text-indigo-600 font-semibold inline-flex items-center">
                Open Page
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;