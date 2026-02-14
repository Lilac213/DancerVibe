// 根据视频拍摄时间推断课堂时间
export const inferClassTime = (creationDate: string, durationMinutes: number = 60): { startTime: string; endTime: string; date: string } => {
  const date = new Date(creationDate);
  
  // 拍摄时间作为课堂结束时间，往前推课时长度得到开始时间
  const endTime = new Date(date);
  const startTime = new Date(date.getTime() - durationMinutes * 60 * 1000);
  
  return {
    startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
    endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
    date: date.toISOString().split('T')[0]
  };
};
