import React from 'react';
import { FaRegCalendar, FaRegClock } from 'react-icons/fa';
import './Horaires.css';

const DateTimePicker = ({ 
  currentDate, 
  selectedTime, 
  onDateChange, 
  onTimeChange,
  lineInfo,
  loading = false
}) => {
  // Fonction pour s'assurer que la date est valide
  const formatDateForInput = (date) => {
    try {
      if (!(date instanceof Date) || isNaN(date)) {
        return new Date().toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  // Fonction pour gérer le changement de date
  const handleDateChange = (e) => {
    try {
      const newDate = new Date(e.target.value);
      if (!isNaN(newDate.getTime())) {
        // Conserver l'heure actuelle
        const currentHours = currentDate.getHours();
        const currentMinutes = currentDate.getMinutes();
        newDate.setHours(currentHours, currentMinutes, 0, 0);
        onDateChange(newDate);
      }
    } catch (error) {
      console.error('Error handling date change:', error);
    }
  };

  if (loading) {
    return (
      <div className="date-time-wrapper">
        <div className="date-time-container" style={{ width: 'calc(100% - 10px)', margin: '0 5px' }}>
          <div className="date-time-field">
            <div className="date-input-group">
              <FaRegCalendar className="date-time-icon text-gray-300 dark:text-gray-600" />
              <div className="h-8 w-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="time-input-group">
              <FaRegClock className="date-time-icon text-gray-300 dark:text-gray-600" />
              <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="date-time-wrapper">
      <div className="date-time-container" style={{ width: 'calc(100% - 10px)', margin: '0 5px' }}>
        <div className="date-time-field">
          <div className="date-input-group">
            <FaRegCalendar className="date-time-icon" />
            <input
              type="date"
              value={formatDateForInput(currentDate)}
              onChange={handleDateChange}
              className="date-time-input no-calendar-icon"
            />
          </div>
          <div className="time-input-group">
            <FaRegClock className="date-time-icon" />
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="date-time-input no-time-icon"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateTimePicker; 