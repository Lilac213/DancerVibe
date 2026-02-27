// 根据视频拍摄时间推断课堂时间
export const inferClassTime = (creationDate: string, durationMinutes: number = 60): { startTime: string; endTime: string; date: string } => {
  const date = new Date(creationDate);
  const minutes = date.getMinutes();
  const hours = date.getHours();
  
  // 找最近的半点作为课堂结束时间
  const nearestHalfHour = minutes >= 15 && minutes < 45 ? 30 : (minutes >= 45 ? 60 : 0);
  const endHour = nearestHalfHour === 60 ? (hours + 1) % 24 : hours;
  const endMinute = nearestHalfHour === 60 ? 0 : nearestHalfHour;
  
  // 往前推课时长度得到开始时间
  const endTimeMs = new Date(date);
  endTimeMs.setHours(endHour, endMinute, 0, 0);
  const startTimeMs = new Date(endTimeMs.getTime() - durationMinutes * 60 * 1000);
  
  return {
    startTime: `${startTimeMs.getHours().toString().padStart(2, '0')}:${startTimeMs.getMinutes().toString().padStart(2, '0')}`,
    endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
    date: date.toISOString().split('T')[0]
  };
};
