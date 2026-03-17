export const getTeacherColor = (teacherName: string): string => {
  if (!teacherName) return 'bg-gray-500';
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < teacherName.length; i++) {
    hash = teacherName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Predefined appealing colors
  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500'
  ];
  
  // Map hash to index
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
