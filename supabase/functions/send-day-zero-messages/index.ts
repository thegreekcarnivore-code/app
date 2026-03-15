import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active enrollments for this user
    const { data: enrollments } = await supabase
      .from("client_program_enrollments")
      .select("id, program_template_id")
      .eq("user_id", user_id)
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ messages_sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get admin user for sending
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "No admin found" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get client name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user_id)
      .single();
    const clientName = profile?.display_name || profile?.email?.split("@")[0] || "there";

    const todayStr = new Date().toISOString().split("T")[0];
    let messagesSent = 0;

    for (const enrollment of enrollments) {
      // Get day_offset=0 messages
      const { data: messages } = await supabase
        .from("program_messages")
        .select("*")
        .eq("program_template_id", enrollment.program_template_id)
        .lte("day_offset", 1)
        .order("sort_order");

      if (messages) {
        for (const msg of messages) {
          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("sender_id", adminRole.user_id)
            .eq("receiver_id", user_id)
            .ilike("content", msg.message_content.substring(0, 50) + "%")
            .limit(1);

          if (!existing || existing.length === 0) {
            const content = msg.message_content.replace(/\{client_name\}/g, clientName);
            await supabase.from("messages").insert({
              sender_id: adminRole.user_id,
              receiver_id: user_id,
              content,
              is_automated: true,
            });
            messagesSent++;
          }
        }
      }

      // Get day_offset=0 tasks
      const { data: tasks } = await supabase
        .from("program_tasks")
        .select("*")
        .eq("program_template_id", enrollment.program_template_id)
        .lte("day_offset", 1)
        .order("sort_order");

      if (tasks) {
        for (const task of tasks) {
          const { data: existingTask } = await supabase
            .from("client_tasks")
            .select("id")
            .eq("user_id", user_id)
            .eq("source_task_id", task.id)
            .limit(1);

          if (!existingTask || existingTask.length === 0) {
            await supabase.from("client_tasks").insert({
              user_id,
              enrollment_id: enrollment.id,
              source_task_id: task.id,
              title: task.title,
              description: task.description,
              task_type: task.task_type,
              due_date: todayStr,
              linked_content_id: task.linked_content_id,
            });

            const taskLink = task.task_type === "measurement"
              ? "/measurements?tab=body"
              : task.task_type === "photo"
              ? "/measurements?tab=photos"
              : task.task_type === "food"
              ? "/measurements?tab=food"
              : "/home";

            await supabase.from("client_notifications").insert({
              user_id,
              type: "task_reminder",
              title: task.title || "New task",
              body: task.description || "You have a new task to complete",
              link: taskLink,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ messages_sent: messagesSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-day-zero-messages error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
