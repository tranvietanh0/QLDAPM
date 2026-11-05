using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class ServerWindow : Form
{
    readonly string root;
    readonly string healthUrl;
    readonly Label state = new Label();
    readonly Label database = new Label();
    readonly TextBox log = new TextBox();
    readonly Button start = new Button();
    readonly Button stop = new Button();
    readonly Timer timer = new Timer();
    Process server;
    bool checking;
    bool closing;

    public ServerWindow(string projectRoot)
    {
        root = projectRoot;
        healthUrl = "http://127.0.0.1:" + (Environment.GetEnvironmentVariable("SERVER_PORT") ?? "8081") + "/api/health";
        Text = "QLDAPM Server - XAMPP MySQL";
        Size = new Size(1050, 720);
        MinimumSize = new Size(760, 480);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(245, 247, 251);
        var header = new Panel { Dock = DockStyle.Top, Height = 128, Padding = new Padding(20) };
        var title = new Label { Text = "QLDAPM SERVER", AutoSize = true, Location = new Point(20, 12), Font = new Font("Segoe UI", 17, FontStyle.Bold) };
        state.Text = "Đang khởi động...";
        state.SetBounds(20, 51, 900, 25);
        state.Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Right;
        database.Text = "XAMPP MySQL · 127.0.0.1:3306 · intern_management";
        database.SetBounds(20, 82, 900, 25);
        database.ForeColor = Color.DimGray;
        header.Controls.AddRange(new Control[] { title, state, database });
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 58, Padding = new Padding(14, 8, 0, 0) };
        start.Text = "Khởi động";
        start.Size = new Size(130, 33);
        start.Click += (s, e) => StartServer();
        stop.Text = "Dừng server";
        stop.Size = new Size(130, 33);
        stop.Click += (s, e) => StopServer();
        var client = new Button { Text = "Mở client", Size = new Size(130, 33) };
        client.Click += (s, e) => OpenClient();
        buttons.Controls.AddRange(new Control[] { start, stop, client });
        log.Multiline = true;
        log.ReadOnly = true;
        log.WordWrap = false;
        log.ScrollBars = ScrollBars.Both;
        log.Dock = DockStyle.Fill;
        log.BackColor = Color.FromArgb(23, 29, 40);
        log.ForeColor = Color.FromArgb(220, 228, 240);
        log.Font = new Font("Consolas", 9);
        Controls.Add(log);
        Controls.Add(header);
        Controls.Add(buttons);
        timer.Interval = 1500;
        timer.Tick += async (s, e) => await UpdateStatus();
        Shown += (s, e) => { timer.Start(); StartServer(); };
        FormClosing += (s, e) => { closing = true; timer.Stop(); StopServer(); };
    }

    void Append(string line)
    {
        if (String.IsNullOrEmpty(line) || closing || IsDisposed) return;
        if (InvokeRequired)
        {
            try { BeginInvoke(new Action<string>(Append), line); } catch (InvalidOperationException) {}
            return;
        }
        if (log.TextLength > 180000) log.Text = log.Text.Substring(log.TextLength - 100000);
        log.AppendText(line + Environment.NewLine);
    }

    Dictionary<string, object> Health()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(healthUrl);
            request.Timeout = 1200;
            request.ReadWriteTimeout = 1200;
            request.Proxy = null;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
        }
        catch { return null; }
    }

    bool IsReady(Dictionary<string, object> result)
    {
        return result != null && result.ContainsKey("service") && (string)result["service"] == "intern-management"
            && result.ContainsKey("status") && (string)result["status"] == "UP";
    }

    async Task UpdateStatus()
    {
        if (checking || closing) return;
        checking = true;
        var health = await Task.Run(() => Health());
        checking = false;
        if (closing) return;
        bool running = server != null && !server.HasExited;
        if (IsReady(health))
        {
            string db = health.ContainsKey("database") ? Convert.ToString(health["database"]) : "chưa xác định";
            state.Text = "ĐANG CHẠY · API sẵn sàng tại " + healthUrl;
            state.ForeColor = Color.FromArgb(20, 130, 70);
            database.Text = "Database: " + db + " · XAMPP 3306 · intern_management";
            if (db == "H2")
            {
                state.Text = "API cũ đang dùng H2. Hãy đóng server demo cũ rồi bấm Khởi động.";
                state.ForeColor = Color.DarkOrange;
            }
        }
        else
        {
            state.Text = running ? "Đang build/khởi động server... Xem nhật ký bên dưới." : "SERVER ĐÃ DỪNG · Bấm Khởi động để chạy.";
            state.ForeColor = running ? Color.DarkOrange : Color.Firebrick;
        }
        start.Enabled = !running && !IsReady(health);
        stop.Enabled = running;
    }

    void StartServer()
    {
        if (server != null && !server.HasExited) return;
        Append("[SERVER] Khởi động với MySQL của XAMPP...");
        start.Enabled = false;
        state.Text = "Đang build/khởi động server...";
        var info = new ProcessStartInfo {
            FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
            Arguments = "/d /c call START_SERVER_MYSQL.bat",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        info.EnvironmentVariables["QLDAPM_NO_PAUSE"] = "1";
        server = new Process { StartInfo = info, EnableRaisingEvents = true };
        server.OutputDataReceived += (s, e) => Append(e.Data);
        server.ErrorDataReceived += (s, e) => Append(e.Data);
        server.Exited += (s, e) => Append("[SERVER] Tiến trình khởi động đã kết thúc.");
        try
        {
            server.Start();
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();
            stop.Enabled = true;
        }
        catch (Exception error)
        {
            server = null;
            Append("[LỖI] " + error.Message);
            start.Enabled = true;
        }
    }

    void StopServer()
    {
        if (server != null)
        {
            try
            {
                if (!server.HasExited)
                {
                    // Only terminate the process tree started by this window.
                    using (var killer = Process.Start(new ProcessStartInfo {
                        FileName = "taskkill.exe", Arguments = "/PID " + server.Id + " /T /F",
                        UseShellExecute = false, CreateNoWindow = true
                    })) { killer.WaitForExit(5000); }
                }
            }
            catch (InvalidOperationException) {}
            server.Dispose();
            server = null;
        }
        if (!closing)
        {
            Append("[SERVER] Đã dừng. MySQL XAMPP vẫn chạy để giữ dữ liệu.");
            start.Enabled = true;
            stop.Enabled = false;
        }
    }

    void OpenClient()
    {
        try
        {
            Process.Start(new ProcessStartInfo {
                FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                Arguments = "/d /c npm run client", WorkingDirectory = root,
                UseShellExecute = false, CreateNoWindow = true
            });
        }
        catch (Exception error) { MessageBox.Show(error.Message, "Không mở được client"); }
    }

    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string projectRoot = args.Length > 0 ? args[0] : Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        if (!File.Exists(Path.Combine(projectRoot, "START_SERVER_MYSQL.bat")))
        {
            MessageBox.Show("Không tìm thấy project. Hãy chạy npm run sever trong thư mục QLDA.", "QLDAPM Server");
            return;
        }
        Application.Run(new ServerWindow(projectRoot));
    }
}
