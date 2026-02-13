// 根据视频拍摄时间推断课堂时间
export const inferClassTime = (creationDate: string): { startTime: string; endTime: string } => {
  const date = new Date(creationDate);
  const minutes = date.getMinutes();
  const hours = date.getHours();
  
  // 找到最近的半点
  const nearestHalfHour = minutes >= 30 ? 30 : 0;
  
  // 往前推一个小时作为开始时间
  let startHour = hours;
  let startMinute = nearestHalfHour;
  
  if (nearestHalfHour === 0) {
    startHour = hours - 1;
    if (startHour < 0) startHour = 23;
  } else {
    startMinute = 30;
    startHour = hours - 1;
    if (startHour < 0) startHour = 23;
  }
  
  // 结束时间就是最近的半点
  const endHour = nearestHalfHour === 30 ? hours : hours;
  const endMinute = nearestHalfHour;
  
  return {
    startTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
    endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
  };
};
