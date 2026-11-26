// Lift the subject out of a painting with macOS Vision (no downloads) and save a transparent PNG.
//   swift cutout.swift in.jpg out.png            every subject Vision finds, one PNG, full size
//   swift cutout.swift in.jpg out.png each       also out_1.png, out_2.png ... one per subject, cropped
//   swift cutout.swift in.jpg out.png box x y w h   also keep this box of the original (furniture Vision drops)
// Vision finds one subject in a crowd painting: crop single figures first (ffmpeg crop), then cut out.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: swift cutout.swift in.jpg out.png [each | box x y w h]"); exit(1) }
let inURL = URL(fileURLWithPath: a[1]), outURL = URL(fileURLWithPath: a[2])
guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("cannot read \(inURL.path)") }
let handler = VNImageRequestHandler(cgImage: img)
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { fatalError("no subject found") }
print("subjects:", obs.allInstances.count)
let ctx = CIContext()
func write(_ ci: CIImage, _ url: URL) {
    guard let out = ctx.createCGImage(ci, from: ci.extent) else { fatalError("render failed") }
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, out, nil); CGImageDestinationFinalize(dest)
    print("wrote", url.path, out.width, "x", out.height)
}
if a.count >= 8 && a[3] == "box" {
    // mask = Vision's mask ∪ the box; picture = the original
    let (bx, by, bw, bh) = (Double(a[4])!, Double(a[5])!, Double(a[6])!, Double(a[7])!)
    let mask = CIImage(cvPixelBuffer: try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler))
    let orig = CIImage(cgImage: img), H = Double(img.height)
    let box = CIImage(color: .white).cropped(to: CGRect(x: bx, y: H - by - bh, width: bw, height: bh))
    let union = box.applyingFilter("CIMaximumCompositing", parameters: [kCIInputBackgroundImageKey: mask]).cropped(to: orig.extent)
    let out = orig.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: orig.extent), kCIInputMaskImageKey: union])
    write(out, outURL)
} else {
    write(CIImage(cvPixelBuffer: try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)), outURL)
    if a.count > 3 && a[3] == "each" {
        for i in obs.allInstances { write(CIImage(cvPixelBuffer: try obs.generateMaskedImage(ofInstances: IndexSet(integer: i), from: handler, croppedToInstancesExtent: true)), URL(fileURLWithPath: outURL.path.replacingOccurrences(of: ".png", with: "_\(i).png"))) }
    }
}
