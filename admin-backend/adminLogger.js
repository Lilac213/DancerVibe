const { supabase } = require('./supabaseClient');

const logOperation = async ({ actor, action, resource_type, resource_id, detail }) => {
  try {
    await supabase.from('admin_operation_logs').insert([{
      actor: actor || 'system',
      action,
      resource_type,
      resource_id: resource_id || null,
      detail: detail || {},
    }]);
  } catch (_) {
  }
};

module.exports = { logOperation };
