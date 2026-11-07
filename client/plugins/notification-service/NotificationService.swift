import UserNotifications

/// Adds the picture to admin promotions. FCM sends it as fcm_options.image; iOS only shows
/// it once this extension downloads it and attaches it to the notification.
class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard let content = bestAttemptContent,
          let options = request.content.userInfo["fcm_options"] as? [String: Any],
          let imageString = options["image"] as? String,
          let imageURL = URL(string: imageString)
    else {
      contentHandler(request.content)
      return
    }

    URLSession.shared.downloadTask(with: imageURL) { location, response, _ in
      defer { contentHandler(content) }
      guard let location = location else { return }
      let ext = Self.fileExtension(for: response, url: imageURL)
      let target = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension(ext)
      do {
        try FileManager.default.moveItem(at: location, to: target)
        let attachment = try UNNotificationAttachment(identifier: "image", url: target)
        content.attachments = [attachment]
      } catch {
        // Show the text-only notification.
      }
    }.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let content = bestAttemptContent {
      contentHandler(content)
    }
  }

  private static func fileExtension(for response: URLResponse?, url: URL) -> String {
    switch response?.mimeType {
    case "image/png": return "png"
    case "image/gif": return "gif"
    case "image/webp": return "webp"
    case "image/jpeg", "image/jpg": return "jpg"
    default: return url.pathExtension.isEmpty ? "jpg" : url.pathExtension
    }
  }
}
