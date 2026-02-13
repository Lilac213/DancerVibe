import Foundation
import Capacitor
import Photos
import AVFoundation

@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin {
    
    @objc func pickVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIImagePickerController()
            picker.sourceType = .photoLibrary
            picker.mediaTypes = ["public.movie"]
            picker.delegate = self
            
            self.bridge?.viewController?.present(picker, animated: true)
            self.bridge?.saveCall(call)
        }
    }
    
    @objc func getVideoUrl(_ call: CAPPluginCall) {
        guard let assetId = call.getString("assetId") else {
            call.reject("Missing assetId")
            return
        }
        
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
        guard let asset = fetchResult.firstObject else {
            call.reject("Asset not found")
            return
        }
        
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        
        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
            if let urlAsset = avAsset as? AVURLAsset {
                call.resolve(["url": urlAsset.url.absoluteString, "duration": asset.duration])
            } else {
                call.reject("Failed to get video URL")
            }
        }
    }
    
    @objc func getThumbnail(_ call: CAPPluginCall) {
        guard let assetId = call.getString("assetId") else {
            call.reject("Missing assetId")
            return
        }
        
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
        guard let asset = fetchResult.firstObject else {
            call.reject("Asset not found")
            return
        }
        
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        
        PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: 300, height: 300), contentMode: .aspectFill, options: options) { image, _ in
            if let image = image, let data = image.jpegData(compressionQuality: 0.8) {
                call.resolve(["thumbnail": data.base64EncodedString()])
            } else {
                call.reject("Failed to get thumbnail")
            }
        }
    }
    
    @objc func checkPermission(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus()
        call.resolve(["status": status.rawValue])
    }
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization { status in
            call.resolve(["status": status.rawValue])
        }
    }
}

extension PhotoLibraryPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        picker.dismiss(animated: true)
        guard let call = self.bridge?.savedCall(withID: "pickVideo") else { return }
        
        if let asset = info[.phAsset] as? PHAsset {
            call.resolve(["assetId": asset.localIdentifier, "duration": asset.duration, "width": asset.pixelWidth, "height": asset.pixelHeight])
        } else {
            call.reject("Failed to get asset")
        }
    }
    
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        if let call = self.bridge?.savedCall(withID: "pickVideo") {
            call.reject("User cancelled")
        }
    }
}
