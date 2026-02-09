export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    // Route guard
    if (url.pathname !== "/api/contact") {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return new Response("Invalid form data", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Honeypot (must stay empty)
    const honeypot = (form.get("website") as string | null)?.trim();
    if (honeypot) {
      // Silently accept bots
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const data = {
      name: form.get("name")?.toString() || "N/A",
      company: form.get("company")?.toString() || "N/A",
      email: form.get("email")?.toString(),
      phone: form.get("phone")?.toString() || "N/A",
      projectType: form.get("projectType")?.toString() || "N/A",
      budget: form.get("budget")?.toString() || "N/A",
      message: form.get("message")?.toString(),
    };

    const consent = form.get("consent") === "on";

    if (!data.email || !data.message || !consent) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }


    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "InnovaFlow <noreply@innovaflow.ca>",
        to: ["kumai.alabbas@innovaflow.ca"],
        reply_to: data.email,
        subject: `Quote request — ${data.projectType}`,
        html: `
          <h3>New quote request</h3>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Company:</strong> ${data.company}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>Project type:</strong> ${data.projectType}</p>
          <p><strong>Budget:</strong> ${data.budget}</p>
          <p><strong>Message:</strong></p>
          <p>${data.message}</p>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();

      console.error("RESEND ERROR:", {
        status: resendResponse.status,
        body: errorText,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Email provider error",
          provider: "resend",
          status: resendResponse.status,
          details: errorText,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  },
};

interface Env {
  RESEND_API_KEY: string;
}
