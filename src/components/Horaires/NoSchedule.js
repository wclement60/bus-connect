import React from 'react';
import { TbClockX } from "react-icons/tb";

const NoSchedule = ({ currentDate }) => {
  const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-[#F6F6F6] rounded-lg p-6">
      <div className="text-center text-gray-500">
        <TbClockX className="w-16 h-16 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">Aucun horaire disponible</p>
        <p className="text-sm">Il n'y a pas de départ prévu pour cette ligne le {formatDate(currentDate)}.</p>
      </div>
    </div>
  );
};

export default NoSchedule; 